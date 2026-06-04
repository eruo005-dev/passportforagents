import "server-only";
import { lookup } from "node:dns/promises";
import { request as httpsRequest, type RequestOptions } from "node:https";
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { isIP } from "node:net";

/**
 * SSRF-hardened fetch for owner-supplied domains.
 *
 * The verification + secret-hygiene flows fetch URLs derived from a domain the
 * *owner* types, so they are SSRF vectors. Before connecting we resolve the host
 * and refuse any address in a private/loopback/link-local/reserved range. We
 * force HTTPS, refuse redirects (an off-domain redirect would break the
 * domain-control guarantee), bound the request with a timeout, and reject
 * oversized bodies on actual streamed bytes.
 *
 * DNS-rebind (TOCTOU) is closed: we connect to the EXACT vetted IP via a pinned
 * `lookup`, while TLS SNI + certificate validation still use the hostname — so
 * a rebind between vetting and connecting cannot redirect us to a private host.
 */

const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 64 * 1024;

function ipIsBlocked(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
    const [a, b] = p;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const ip6 = ip.toLowerCase();
    if (ip6 === "::1" || ip6 === "::") return true; // loopback / unspecified
    if (ip6.startsWith("fe80")) return true; // link-local
    if (ip6.startsWith("fc") || ip6.startsWith("fd")) return true; // unique local fc00::/7
    const mapped = ip6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipIsBlocked(mapped[1]);
    return false;
  }
  return true; // not a valid IP → block
}

export class UnsafeUrlError extends Error {}

/** A fetch implementation that vets + pins the target IP before connecting. */
export async function safeFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(input.toString());
  if (url.protocol !== "https:") {
    throw new UnsafeUrlError("Only HTTPS URLs may be verified");
  }

  // Resolve and vet every address the host maps to; pin the first vetted one.
  let addrs: { address: string; family: number }[];
  try {
    addrs = await lookup(url.hostname, { all: true });
  } catch {
    throw new UnsafeUrlError(`Could not resolve host: ${url.hostname}`);
  }
  if (addrs.length === 0 || addrs.some((a) => ipIsBlocked(a.address))) {
    throw new UnsafeUrlError(
      `Refusing to fetch ${url.hostname}: resolves to a private or reserved address`,
    );
  }
  const pinned = addrs[0];

  const headers: Record<string, string> = { accept: "application/json" };
  if (init?.headers) {
    for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
      headers[k] = v;
    }
  }

  const options: RequestOptions = {
    method: "GET",
    servername: url.hostname, // SNI + cert validation use the hostname…
    // …but the socket connects to the exact vetted IP (DNS-rebind closed).
    lookup: (_hostname, _opts, cb) =>
      cb(null, pinned.address, pinned.family as 4 | 6),
    headers,
    timeout: FETCH_TIMEOUT_MS,
  };

  const res = await new Promise<IncomingMessage>((resolve, reject) => {
    const req = httpsRequest(url, options, resolve);
    req.on("timeout", () => req.destroy(new UnsafeUrlError("request timed out")));
    req.on("error", reject);
    req.end();
  });

  const status = res.statusCode ?? 0;
  if (status >= 300 && status < 400) {
    res.destroy();
    throw new UnsafeUrlError("redirects are not allowed during verification");
  }

  const declared = Number(res.headers["content-length"] ?? "0");
  if (declared > MAX_BODY_BYTES) {
    res.destroy();
    throw new UnsafeUrlError("agent-passport.json is too large");
  }

  const outHeaders = new Headers();
  for (const [k, v] of Object.entries(res.headers)) {
    if (typeof v === "string") outHeaders.set(k, v);
  }

  // Reuse the streamed-byte cap via a web Response wrapper.
  const webBody = Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>;
  const bytes = await readCapped(
    new Response(webBody, { status, headers: outHeaders }),
    MAX_BODY_BYTES,
  );

  return new Response(new TextDecoder().decode(bytes), {
    status,
    statusText: res.statusMessage,
    headers: outHeaders,
  });
}

/** Read a response body, aborting if it exceeds `max` bytes. Exported for tests. */
export async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > max) throw new UnsafeUrlError("agent-passport.json is too large");
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new UnsafeUrlError("agent-passport.json is too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

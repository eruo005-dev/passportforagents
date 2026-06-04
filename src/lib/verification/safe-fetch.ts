import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF-hardened fetch for owner-supplied domains.
 *
 * The verification flow fetches a URL derived from a domain the *owner* types,
 * so it is an SSRF vector. Before fetching we resolve the host and refuse any
 * address in a private / loopback / link-local / reserved range. We also force
 * HTTPS, refuse redirects (an off-domain redirect would break the
 * domain-control guarantee), bound the request with a timeout, and reject
 * oversized bodies.
 *
 * Note (v1): we check the resolved IP then fetch by hostname, so a determined
 * attacker could DNS-rebind between the two. Acceptable for v1; a future
 * hardening is to pin the vetted IP. Documented in PROGRESS.md.
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
    // IPv4-mapped (::ffff:a.b.c.d) → re-check the embedded v4.
    const mapped = ip6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipIsBlocked(mapped[1]);
    return false;
  }
  return true; // not a valid IP → block
}

export class UnsafeUrlError extends Error {}

/** A fetch implementation that vets the target before connecting. */
export async function safeFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(input.toString());

  if (url.protocol !== "https:") {
    throw new UnsafeUrlError("Only HTTPS URLs may be verified");
  }

  // Resolve and vet every address the host maps to.
  let addrs: { address: string }[];
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });

    // Fast reject on an honest content-length…
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_BODY_BYTES) {
      throw new UnsafeUrlError("agent-passport.json is too large");
    }

    // …but never trust it: enforce the cap on the actual streamed bytes so a
    // chunked / lying server can't stream an unbounded body into memory.
    const bytes = await readCapped(res, MAX_BODY_BYTES);
    const body = new TextDecoder().decode(bytes);

    // Re-wrap so callers (which call res.json()) get a normal Response.
    return new Response(body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  } finally {
    clearTimeout(timer);
  }
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

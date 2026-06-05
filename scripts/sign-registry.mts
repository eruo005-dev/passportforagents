/**
 * Reusable registry re-signer (issuer side, PassportForAgents).
 *
 * Recomputes the AgoraMind registry digest from a roster file using the
 * published canonicalization, then ed25519-signs the RAW 32-byte digest with a
 * domain key. Prints ONLY public material (public key + signature + digest +
 * signed_at). The private seed is never printed.
 *
 *   npx tsx scripts/sign-registry.mts --roster <agents.json> [--key <secret.json>] [--expect <hex>] [--signed-at <iso>]
 *   npx tsx scripts/sign-registry.mts --digest <hex>          [--key <secret.json>] [--signed-at <iso>]
 *
 * Canonicalization (must match the verifier exactly):
 *   sha256( JSON.stringify( agents.map(a => [uuid, id]).sort(asc by uuid) ) )   // compact
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  sign as edSign,
  verify as edVerify,
  publicKeyFromSecret,
} from "../src/lib/crypto/ed25519";
import { encodePublicKey, encodeSignature } from "../src/lib/crypto/multibase";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hexToBytes = (h: string) =>
  Uint8Array.from(h.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
const bytesToHex = (b: Uint8Array) =>
  [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

const keyPath = arg("--key") ?? "agoramind-passport-key.SECRET.json";
const rosterPath = arg("--roster");
const signedAt = arg("--signed-at") ?? new Date().toISOString();
const expect = arg("--expect");

// 1. Resolve the digest: either recompute from the roster, or take it directly.
let digestHex = arg("--digest");
if (rosterPath) {
  const doc = JSON.parse(readFileSync(rosterPath, "utf8"));
  const agents: Array<{ uuid: string; id: string }> = Array.isArray(doc)
    ? doc
    : doc.agents;
  const pairs = agents
    .map((a) => [a.uuid, a.id] as const)
    .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  const canonical = JSON.stringify(pairs);
  digestHex = createHash("sha256").update(canonical, "utf8").digest("hex");
}
if (!digestHex) throw new Error("provide --roster <file> or --digest <hex>");

// 2. Load the domain seed, derive the public key.
const secret = JSON.parse(readFileSync(keyPath, "utf8")) as {
  secret_key_hex: string;
};
const seed = hexToBytes(secret.secret_key_hex);
const pub = publicKeyFromSecret(seed);

// 3. Sign the RAW 32-byte digest (locked convention).
const digestBytes = hexToBytes(digestHex);
const sigRaw = edSign(digestBytes, seed);

console.log(
  JSON.stringify(
    {
      computed_digest: digestHex,
      expect_match: expect ? digestHex === expect : undefined,
      agent_count: rosterPath
        ? (JSON.parse(readFileSync(rosterPath, "utf8")).agents?.length ??
          JSON.parse(readFileSync(rosterPath, "utf8")).length)
        : undefined,
      signed_block: {
        public_key: encodePublicKey(pub),
        signature: encodeSignature(sigRaw),
        signature_alg: "ed25519",
        digest: digestHex,
        signed_at: signedAt,
        self_verify: edVerify(sigRaw, digestBytes, pub),
      },
      signature_hex: bytesToHex(sigRaw),
    },
    null,
    2,
  ),
);

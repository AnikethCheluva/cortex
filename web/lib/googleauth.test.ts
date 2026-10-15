import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { generateKeyPairSync, createSign, type KeyObject } from "crypto";

// Verify the Google ID-token checks by standing in for Google's JWKS with a
// locally-generated key pair, so every rejection path actually runs. A bug here
// would mean anyone could sign in, so each guard gets its own case.

const CLIENT_ID = "test-client.apps.googleusercontent.com";
let priv: KeyObject;
let wrongPriv: KeyObject;
let verify: (c: string) => Promise<{ email: string }>;

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

function token(
  claims: Record<string, unknown> = {},
  key: KeyObject = priv,
  header: Record<string, unknown> = {},
) {
  const h = b64({ alg: "RS256", kid: "testkid", ...header });
  const p = b64({
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: "owner@example.com",
    email_verified: true,
    sub: "123",
    ...claims,
  });
  const sig = createSign("RSA-SHA256").update(`${h}.${p}`).sign(key).toString("base64url");
  return `${h}.${p}.${sig}`;
}

beforeAll(async () => {
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.ALLOWED_EMAILS = "owner@example.com, other@example.com";
  process.env.AUTH_SECRET = "s3cret";

  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  priv = pair.privateKey;
  wrongPriv = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const jwk = { ...pair.publicKey.export({ format: "jwk" }), kid: "testkid", alg: "RS256", use: "sig" };

  vi.stubGlobal("fetch", async () =>
    new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "max-age=3600" },
    }),
  );

  ({ verifyGoogleIdToken: verify } = await import("@/lib/googleauth"));
});

afterAll(() => vi.unstubAllGlobals());

describe("verifyGoogleIdToken", () => {
  it("accepts a correctly-signed token from an allowlisted address", async () => {
    await expect(verify(token())).resolves.toMatchObject({ email: "owner@example.com" });
  });

  it("accepts any address on the allowlist", async () => {
    await expect(verify(token({ email: "other@example.com" }))).resolves.toMatchObject({
      email: "other@example.com",
    });
  });

  it("normalizes case when matching the allowlist", async () => {
    await expect(verify(token({ email: "Owner@Example.COM" }))).resolves.toMatchObject({
      email: "owner@example.com",
    });
  });

  it("rejects an address that is not on the allowlist", async () => {
    await expect(verify(token({ email: "stranger@evil.com" }))).rejects.toThrow(/not allowed/i);
  });

  it("rejects a token signed by the wrong key", async () => {
    await expect(verify(token({}, wrongPriv))).rejects.toThrow(/signature is invalid/i);
  });

  it("rejects a token minted for a different app", async () => {
    await expect(verify(token({ aud: "someone-else.apps.googleusercontent.com" }))).rejects.toThrow(
      /different app/i,
    );
  });

  it("rejects an expired token", async () => {
    await expect(verify(token({ exp: Math.floor(Date.now() / 1000) - 3600 }))).rejects.toThrow(
      /expired/i,
    );
  });

  it("rejects an unverified email", async () => {
    await expect(verify(token({ email_verified: false }))).rejects.toThrow(/not verified/i);
  });

  it("rejects a token from the wrong issuer", async () => {
    await expect(verify(token({ iss: "https://evil.example" }))).rejects.toThrow(/issuer/i);
  });

  it("rejects an alg=none downgrade", async () => {
    await expect(verify(token({}, priv, { alg: "none" }))).rejects.toThrow(/algorithm/i);
  });

  it("rejects a token signed with an unknown key id", async () => {
    await expect(verify(token({}, priv, { kid: "not-a-real-kid" }))).rejects.toThrow(
      /known Google key/i,
    );
  });

  it("rejects malformed input", async () => {
    await expect(verify("not.a.jwt")).rejects.toThrow();
  });
});

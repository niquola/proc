// The workspace's own signing key. Generated on first use and kept in
// .runtime/auth-key.json (0600), so the magic link printed at boot survives a
// restart — logging everyone out because the process bounced is not security,
// it is an interruption.
//
// RS256 because that is what a manager will hand us later: one verify path,
// two possible keys.
import { chmod } from "node:fs/promises";

const ALG = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" } as const;
const FILE = ".runtime/auth-key.json";

export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey; jwk: Awaited<ReturnType<typeof crypto.subtle.exportKey>> }> {
    if (ctx.state.authKeys) return ctx.state.authKeys;

    const saved = await Bun.file(FILE).json().catch(() => null);
    if (saved) {
        ctx.state.authKeys = {
            privateKey: await crypto.subtle.importKey("jwk", saved.private, ALG, false, ["sign"]),
            publicKey: await crypto.subtle.importKey("jwk", saved.public, ALG, true, ["verify"]),
            jwk: saved.public,
        };
        return ctx.state.authKeys;
    }

    const pair = await crypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    await Bun.write(FILE, JSON.stringify({ private: await crypto.subtle.exportKey("jwk", pair.privateKey), public: jwk }));
    await chmod(FILE, 0o600).catch(() => { /* an fs without modes */ });

    ctx.state.authKeys = { privateKey: pair.privateKey, publicKey: pair.publicKey, jwk };
    return ctx.state.authKeys;
}

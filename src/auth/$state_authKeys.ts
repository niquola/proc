// The workspace's signing key for this machine, loaded or generated once by
// auth.keys and kept in .runtime/auth-key.json.
export type authKeys = { privateKey: CryptoKey; publicKey: CryptoKey; jwk: Awaited<ReturnType<typeof crypto.subtle.exportKey>> };

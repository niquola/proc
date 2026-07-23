// Mint a token for a person. The name travels in the token — the UI greets
// them with it, the chat can say who is talking, and a later audit line has
// something to write down. A token without a name is an anonymous key, which is
// not what a session is for.
export default async function (ctx: Context, _session: Session | null, opts: { sub: string; name: string; email?: string; days?: number }): Promise<string> {
    const { privateKey } = await ctx.fns.auth.keys({});
    const days = opts.days ?? ctx.fns.config.resolve({ module: "auth" }).days;
    const now = Math.floor(Date.now() / 1000);

    const header = { alg: "RS256", typ: "JWT" };
    const claims = { sub: opts.sub, name: opts.name, email: opts.email, iss: "workspace", iat: now, exp: now + days * 86400 };
    const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(body));
    return `${body}.${b64url(new Uint8Array(signature))}`;
}

function b64url(input: string | Uint8Array): string {
    const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
    return Buffer.from(bytes).toString("base64url");
}

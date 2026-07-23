// GET /auth?token=<jwt> — the magic link. The workspace prints one at boot and
// a manager will send one later; both land here, and both are checked by the
// same verify. On success the token becomes the session cookie and the person
// ends up where they were going.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const url = new URL(opts.req.url);
    const token = url.searchParams.get("token") ?? "";
    const next = url.searchParams.get("next") || "/";
    const user = token ? await ctx.fns.auth.verify({ token }) : null;
    if (!user) return new Response(null, { status: 302, headers: { location: "/auth/login?bad=1" } });

    return new Response(null, {
        status: 302,
        headers: { location: next, "set-cookie": ctx.fns.auth.cookie({ token, url: opts.req.url }) },
    });
}

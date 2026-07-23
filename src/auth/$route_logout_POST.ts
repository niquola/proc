// POST /auth/logout — drop the cookie.
export default function (ctx: Context, _session: Session, opts: { req: Request }) {
    return new Response(null, { status: 303, headers: { location: "/auth/login", "set-cookie": ctx.fns.auth.cookie({ url: opts.req.url }) } });
}

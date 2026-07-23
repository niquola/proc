// Who is making this request, according to the cookie it carries. Returns null
// when there is nobody — the caller decides whether that matters.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    const token = new Bun.CookieMap(opts.req.headers.get("cookie") ?? "").get(COOKIE);
    return token ? await ctx.fns.auth.verify({ token }) : null;
}

export const COOKIE = "workspace_session";

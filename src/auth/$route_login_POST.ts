// POST /login — a pasted token becomes a session. Same verify as the magic
// link, so there is nothing here that could accept something the link would not.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const form = await opts.req.formData();
    const token = String(form.get("token") ?? "").trim();
    const next = String(form.get("next") ?? "/") || "/";
    const user = token ? await ctx.fns.auth.verify({ token }) : null;
    if (!user) {
        return new Response(ctx.fns.auth.screen({ next, error: token ? "That token was not valid." : "Paste the token the workspace printed." }), {
            status: 401, headers: { "content-type": "text/html; charset=utf-8" },
        });
    }
    return new Response(null, { status: 303, headers: { location: next, "set-cookie": ctx.fns.auth.cookie({ token, url: opts.req.url }) } });
}

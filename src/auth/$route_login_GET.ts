// GET /login — the screen. Its own page, not the workspace layout: the layout
// loads the chat, the event stream and the injection bridge, none of which a
// stranger should get.
export default function (ctx: Context, _session: Session, opts: { req: Request }) {
    const url = new URL(opts.req.url);
    return new Response(ctx.fns.auth.screen({ next: url.searchParams.get("next") ?? "/", error: url.searchParams.get("bad") ? "That token was not valid." : undefined }), {
        headers: { "content-type": "text/html; charset=utf-8" },
    });
}

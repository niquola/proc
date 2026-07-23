// GET /chat/who — the presence chips on their own, refetched when somebody
// joins or leaves.
export default function (ctx: Context, _session: Session, _opts: { req: Request }) {
    return new Response(ctx.fns.chat.who({}), { headers: { "content-type": "text/html; charset=utf-8" } });
}

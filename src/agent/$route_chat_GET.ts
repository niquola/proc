// GET /agent/chat — the transcript fragment; the layout swaps it on SSE events.
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    return new Response(ctx.fns.agent.chat({}), { headers: { "content-type": "text/html; charset=utf-8" } });
}

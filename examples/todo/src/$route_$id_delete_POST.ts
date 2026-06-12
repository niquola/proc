// POST /todo/:id/delete — remove, return the updated list fragment.
export default function (ctx: Context, _session: Session, opts: { req: Request; params: Record<string, string> }) {
    ctx.fns.todo.remove({ id: Number(opts.params.id) });
    return new Response(ctx.fns.todo.render({}), { headers: { "content-type": "text/html; charset=utf-8" } });
}

// POST /page/result — a tab answering an injected evaluation.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const { id, value, error } = await opts.req.json();
    const waiter = ctx.state.page?.pending.get(id);
    if (!waiter) return { ignored: id };
    ctx.state.page.pending.delete(id);
    error ? waiter.reject(new Error(error)) : waiter.resolve(value);
    return { ok: true };
}

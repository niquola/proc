export default function (ctx: Context, _session: Session | null, opts: { id: number }) {
    ctx.fns.db.run({ sql: "DELETE FROM todos WHERE id = ?", params: [opts.id] });
    return { ok: true };
}

export default function (ctx: Context, _session: Session | null, opts: { id: number }) {
    ctx.fns.db.run({ sql: "UPDATE todos SET done = 1 - done WHERE id = ?", params: [opts.id] });
    return { ok: true };
}

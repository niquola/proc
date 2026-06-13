// Roll back the most recently applied migration (or N via opts.steps), running
// its down(ctx) and removing it from _migrations.
export default async function (ctx: Context, _session: Session | null, opts?: { steps?: number }) {
    const steps = opts?.steps ?? 1;
    const byId = new Map((ctx.state.migrations ?? []).map((m) => [m.id, m]));
    const applied = ctx.fns.db.query({ sql: "SELECT id FROM _migrations ORDER BY id DESC" }).map((r: any) => r.id);

    const rolledBack: string[] = [];
    for (const id of applied.slice(0, steps)) {
        const m = byId.get(id);
        if (m?.down) await m.down(ctx);
        ctx.fns.db.run({ sql: "DELETE FROM _migrations WHERE id = ?", params: [id] });
        console.log(`[migrate] down ${id}${m?.down ? "" : " (no down — record removed)"}`);
        rolledBack.push(id);
    }
    return { rolledBack };
}

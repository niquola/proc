// Migration status: each known migration with applied/pending.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    ctx.fns.db.exec({ sql: "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)" });
    const applied = new Set(ctx.fns.db.query({ sql: "SELECT id FROM _migrations" }).map((r: any) => r.id));
    return [...(ctx.state.migrations ?? [])]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((m) => ({ id: m.id, applied: applied.has(m.id) }));
}

export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    ctx.fns.todos.migrate({}); // idempotent (CREATE IF NOT EXISTS) — example stays self-contained
    return ctx.fns.db.query({ sql: "SELECT id, title, done FROM todos ORDER BY id" });
}

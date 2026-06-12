export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    return ctx.fns.db.query({ sql: "SELECT id, title, done FROM todos ORDER BY id" });
}

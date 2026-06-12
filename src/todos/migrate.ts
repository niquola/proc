// Example domain on top of db/. Idempotent schema.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    ctx.fns.db.exec({
        sql: `CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            done INTEGER NOT NULL DEFAULT 0
        )`,
    });
    return { ok: true };
}

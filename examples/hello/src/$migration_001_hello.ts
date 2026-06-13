// $migration_<id>.ts → { up, down? }. Run in id order by ctx.fns.migrate.up
// (at boot via the migrate lifecycle, or `bun script/cli.ts migrate`), tracked
// in _migrations. Demonstrates a plugin contributing schema.
export default {
    up: (ctx: Context) => ctx.fns.db.exec({ sql: "CREATE TABLE IF NOT EXISTS hello_log (id INTEGER PRIMARY KEY, at TEXT)" }),
    down: (ctx: Context) => ctx.fns.db.exec({ sql: "DROP TABLE IF EXISTS hello_log" }),
};

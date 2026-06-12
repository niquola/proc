// Lazily open the sqlite connection and cache it on ctx.state.db. Because state
// is per-ctx, a forked test env (env.fork) gets its OWN isolated connection —
// dev's file db and a test's :memory: db never touch.
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export default function (ctx: Context, _session: Session | null, _opts?: {}): Database {
    const st = ctx.state as any;
    if (st.db) return st.db;
    const url = ctx.fns.db.url();
    if (url !== ":memory:" && url.includes("/")) mkdirSync(dirname(url), { recursive: true });
    st.db = new Database(url);
    return st.db;
}

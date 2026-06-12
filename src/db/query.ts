// SELECT → rows. params: array (positional ?) or object (named $x).
export default function (ctx: Context, _session: Session | null, opts: { sql: string; params?: any }): any[] {
    const stmt = ctx.fns.db.conn().query(opts.sql);
    const p = opts.params;
    return Array.isArray(p) ? stmt.all(...p) : p != null ? stmt.all(p) : stmt.all();
}

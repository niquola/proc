// What the materialized table actually holds. Aidbox puts a ViewDefinition's
// table in the `sof` schema under the view's name; the name is inlined because
// Postgres will not take a table name as a parameter, so it is checked against
// a strict pattern first.
//
// Errors come back as a value rather than a throw: "the table is not there yet"
// is the normal state of a view you just wrote, and the page should say so.
export default async function (ctx: Context, _session: Session | null, opts: { name: string; limit?: number }): Promise<{ rows: any[]; error: string | null }> {
    if (!/^[a-z0-9_]+$/i.test(opts.name)) return { rows: [], error: `invalid view name: ${opts.name}` };
    try {
        const rows = await ctx.fns.aidbox.sql({ sql: `SELECT * FROM sof.${opts.name} LIMIT ${Math.min(opts.limit ?? 25, 200)}` });
        return { rows, error: null };
    } catch (error: any) {
        return { rows: [], error: String(error?.message ?? error) };
    }
}

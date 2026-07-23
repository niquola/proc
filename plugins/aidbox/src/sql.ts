// SQL against Aidbox's database through `POST /$sql`. The body is a JSON array:
// the statement first, then its `?` parameters — never string-interpolate a
// value into the statement.
//
//   ctx.fns.aidbox.sql({ sql: "select count(*) from patient" })          → [{ count: 5 }]
//   ctx.fns.aidbox.sql({ sql: "select * from patient where id = ?", params: ["pt-1"] })
export default async function (ctx: Context, _session: Session | null, opts: { sql: string; params?: any[] }): Promise<any[]> {
    return await ctx.fns.aidbox.request({ path: "/$sql", method: "POST", body: [opts.sql, ...(opts.params ?? [])] });
}

// A chart's rows. `dataSource.sql` is a small SELECT — against a materialized
// ViewDefinition table (`sof.<name>`) rather than raw FHIR JSONB, because that
// extraction belongs in a view where it is written once and reused.
//
// `params` fill the `?` placeholders; the route may override them from the query
// string, so one spec serves many pages.
//
// The error comes back as a value: "the table is not there yet" is the normal
// state of a chart written before its view was materialized, and the page should
// say so rather than 500.
export default async function (ctx: Context, _session: Session | null, opts: { chart: any; params?: any[] }): Promise<{ rows: any[]; error: string | null }> {
    const source = opts.chart.dataSource;
    if (!source?.sql) return { rows: [], error: null };            // a spec may carry its own data
    try {
        return { rows: await ctx.fns.aidbox.sql({ sql: source.sql, params: opts.params ?? source.params }), error: null };
    } catch (error: any) {
        return { rows: [], error: String(error?.message ?? error) };
    }
}

// Build the table. The definition is PUT into Aidbox first — the file on disk is
// the source of truth, so materializing an edited file materializes the edit —
// and then `$materialize` flattens matching resources into `sof.<name>`.
export default async function (ctx: Context, _session: Session | null, opts: { id: string; type?: "table" | "view" | "materialized-view" }) {
    const viewdef = await ctx.fns.viewdef.load({ id: opts.id });
    await ctx.fns.aidbox.request({ path: `/fhir/ViewDefinition/${encodeURIComponent(opts.id)}`, method: "PUT", body: viewdef });
    const result = await ctx.fns.aidbox.request({
        path: `/fhir/ViewDefinition/${encodeURIComponent(opts.id)}/$materialize`,
        method: "POST",
        body: { resourceType: "Parameters", parameter: [{ name: "type", valueCode: opts.type ?? "table" }] },
    });
    return { id: opts.id, table: `sof.${viewdef.name ?? opts.id}`, result };
}

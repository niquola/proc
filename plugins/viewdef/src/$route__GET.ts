// GET /viewdef — every ViewDefinition the project ships, with what it flattens
// and how wide the result is. The list is the map of what this project can query
// in SQL rather than in FHIR.
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    const views = await ctx.fns.viewdef.local({});

    const rows = views.map(v => ctx.fns.ui.row({
        entity: "viewdef", id: v.id,
        href: `/viewdef/view?id=${encodeURIComponent(v.id)}`,
        cells: [
            { role: "name", text: v.name, class: "min-w-0 flex-1 truncate text-text-link" },
            { role: "resource", text: v.resource, class: "w-40 shrink-0 truncate text-2xs text-text-tertiary" },
            { role: "columns", text: `${v.columns} columns`, class: "w-24 shrink-0 text-2xs text-text-tertiary" },
            { role: "table", text: `sof.${v.name}`, class: "shrink-0 font-mono text-3xs text-text-placeholder" },
        ],
    })).join("");

    return {
        title: "views",
        main: ctx.fns.ui.page({
            page: "views",
            title: "Views",
            lead: `A SQL-on-FHIR <span class="font-mono">ViewDefinition</span> flattens resources into a table you can query with SQL. The project keeps them as <span class="font-mono">$viewdef_&lt;id&gt;.json</span>; Aidbox materializes each one into the <span class="font-mono">sof</span> schema.`,
            main: ctx.fns.ui.box({
                class: "mt-4",
                title: `${views.length} in this project`,
                body: rows,
                empty: "none yet — write $viewdef_<id>.json with { name, resource, select }",
            }),
        }),
    };
}

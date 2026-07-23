// GET /viewdef — every ViewDefinition the project ships, with what it flattens
// and how wide the result is. The list is the map of what this project can query
// in SQL rather than in FHIR.
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    const views = await ctx.fns.viewdef.local({});

    const row = (v: { id: string; name: string; resource: string; file: string; columns: number }) => `<a class="flex items-center gap-3 border-t border-border-subtle px-4 py-2.5 hover:bg-bg-tertiary"
  href="/viewdef/view?id=${encodeURIComponent(v.id)}"
  hx-get="/viewdef/view?id=${encodeURIComponent(v.id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true"
  data-entity="viewdef" data-id="${esc(v.id)}">
  <span class="min-w-0 flex-1 truncate text-text-link">${esc(v.name)}</span>
  <span class="w-40 shrink-0 truncate text-2xs text-text-tertiary">${esc(v.resource)}</span>
  <span class="w-24 shrink-0 text-2xs text-text-tertiary">${v.columns} columns</span>
  <span class="shrink-0 font-mono text-3xs text-text-placeholder">sof.${esc(v.name)}</span>
</a>`;

    return {
        title: "views",
        main: `<h1 class="text-lg font-semibold">Views</h1>
<p class="mt-1 text-2xs text-text-tertiary">A SQL-on-FHIR <span class="font-mono">ViewDefinition</span> flattens resources into a table you can query with SQL. The project keeps them as <span class="font-mono">$viewdef_&lt;id&gt;.json</span>; Aidbox materializes each one into the <span class="font-mono">sof</span> schema.</p>

<div class="mt-4 overflow-hidden rounded-md border border-border-subtle">
  <div class="bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">${views.length} in this project</div>
  ${views.length ? views.map(row).join("") : `<div class="border-t border-border-subtle px-4 py-3 text-2xs text-text-tertiary">none yet — write <span class="font-mono">$viewdef_&lt;id&gt;.json</span> with { name, resource, select }</div>`}
</div>`,
    };
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

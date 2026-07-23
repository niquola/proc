// GET /viewdef/view?id= — one ViewDefinition: the columns it declares, the rows
// the table holds, and the definition itself. The three questions in order —
// what did I ask for, what did I get, and what exactly did I write.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const id = new URL(opts.req.url).searchParams.get("id") ?? "";
    const viewdef: any = await ctx.fns.viewdef.load({ id }).catch(() => null);
    if (!viewdef) return {
        title: "views", status: 404,
        main: ctx.fns.ui.page({ page: "view", main: `<div class="text-state-danger-fg">No ViewDefinition <span class="font-mono">${esc(id)}</span> in this project</div>` }),
    };

    const name = viewdef.name ?? id;
    const columns = ctx.fns.viewdef.columns({ viewdef });
    const rows = await ctx.fns.viewdef.rows({ name, limit: 25 });
    const file = (await ctx.fns.viewdef.local({})).find(v => v.id === id)?.file;

    const columnRows = `<table class="w-full text-2xs">
    <tbody>${columns.map(c => `<tr class="border-t border-border-subtle" ${ctx.fns.ui.attr({ entity: "column", id: c.name })}>
      <td class="w-56 px-4 py-1.5 font-mono" ${ctx.fns.ui.attr({ role: "name" })}>${esc(c.name)}</td>
      <td class="px-4 py-1.5 font-mono text-text-muted" ${ctx.fns.ui.attr({ role: "path" })}>${esc(c.path)}</td>
      <td class="w-32 px-4 py-1.5 text-text-tertiary" ${ctx.fns.ui.attr({ role: "type" })}>${esc(c.type ?? "")}</td>
    </tr>`).join("")}</tbody>
  </table>`;

    return {
        title: name,
        main: ctx.fns.ui.page({
            page: "view",
            main: `<div class="flex items-baseline justify-between gap-4">
  <div>
    <h1 class="text-lg font-semibold">${esc(name)}</h1>
    <div class="mt-0.5 text-2xs text-text-tertiary">${esc(viewdef.resource ?? "?")} → <span class="font-mono">sof.${esc(name)}</span>${file ? ` · <a class="font-mono text-text-link hover:underline" href="/filemanager?path=${encodeURIComponent(file)}" hx-get="/filemanager?path=${encodeURIComponent(file)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">${esc(file)}</a>` : ""}</div>
  </div>
  <div class="flex shrink-0 items-center gap-3">
    ${ctx.fns.ui.button({ action: "materialize", entity: "viewdef", id, label: "Materialize", post: "/viewdef/materialize", vals: { id } })}
    <a class="text-2xs text-text-link hover:underline" href="/viewdef" hx-get="/viewdef" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">← back</a>
  </div>
</div>

${ctx.fns.ui.box({ class: "mt-6", title: `${columns.length} columns`, body: columnRows })}

<div class="mt-6">${ctx.fns.viewdef.table({ columns, rows: rows.rows, error: rows.error, table: `sof.${name}` })}</div>

<details class="mt-6 overflow-hidden rounded-md border border-border-subtle">
  <summary class="cursor-pointer bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">ViewDefinition</summary>
  <pre class="overflow-x-auto border-t border-border-subtle p-4 font-mono text-2xs">${esc(JSON.stringify(viewdef, null, 2))}</pre>
</details>`,
        }),
    };
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

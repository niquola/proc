// What the file manager shows instead of a `$viewdef_*.json`: the columns it
// declares and the rows the table holds. A ViewDefinition is only interesting
// against data — the JSON says what it should produce, this says what it does.
import { basename } from "node:path";

export default async function (ctx: Context, _session: Session | null, opts: { path: string }): Promise<string | null> {
    const viewdef: any = await ctx.fns.viewdef.load({ file: opts.path }).catch(() => null);
    if (!viewdef) return null;                                   // malformed — the JSON view says why

    const id = viewdef.id ?? basename(opts.path).replace(/^\$viewdef_|\.json$/g, "");
    const name = viewdef.name ?? id;
    const columns = ctx.fns.viewdef.columns({ viewdef });
    const rows = await ctx.fns.viewdef.rows({ name, limit: 10 });

    return `<div class="flex items-baseline justify-between gap-4 border-b border-border-subtle bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary" ${ctx.fns.ui.attr({ entity: "viewdef", id })}>
  <span>ViewDefinition · ${esc(viewdef.resource ?? "?")} → <span class="font-mono">sof.${esc(name)}</span> · ${columns.length} columns</span>
  <a class="shrink-0 text-text-link hover:underline" href="/viewdef/view?id=${encodeURIComponent(id)}"
    hx-get="/viewdef/view?id=${encodeURIComponent(id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">open in Views</a>
</div>
<div class="p-4">${ctx.fns.viewdef.table({ columns, rows: rows.rows, error: rows.error, table: `sof.${name}` })}</div>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

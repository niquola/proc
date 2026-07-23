// One row of a box, and the reason the convention holds: a row is an entity, so
// it carries `entity`+`id` (and `status` when it has one) and every cell it is
// made of carries its `role`. Written this way a plugin cannot produce a row the
// workspace is unable to point at, and `page.state` reports the cells as the
// entity's fields without anyone thinking about it.
//
// `href` makes the row a link — page.open({entity,id}) follows it — and htmx
// swaps the pane rather than reloading the window.
export default function (ctx: Context, _session: Session | null, opts: {
    entity: string; id: string; status?: string; href?: string;
    cells: Array<{ role: string; text?: string; html?: string; class?: string }>;
    right?: string;
}): string {
    const cells = opts.cells.map(c =>
        `<span class="${c.class ?? "min-w-0 flex-1 truncate"}" ${ctx.fns.ui.attr({ role: c.role })}>${c.html ?? esc(c.text)}</span>`).join("");
    const inside = `${cells}${opts.right ?? ""}`;
    const marks = ctx.fns.ui.attr({ entity: opts.entity, id: opts.id, status: opts.status });
    const cls = "flex items-center gap-3 border-t border-border-subtle px-4 py-2.5 hover:bg-bg-tertiary";

    return opts.href
        ? `<a class="${cls}" href="${esc(opts.href)}" hx-get="${esc(opts.href)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true" ${marks}>${inside}</a>`
        : `<div class="${cls}" ${marks}>${inside}</div>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

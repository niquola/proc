// A bordered box with a grey strip on top — the workspace's one way of putting
// a list, a table or a rendered thing on the page. The strip says what is in it
// and how much; `right` is where a box-wide action goes.
//
// `body` is html, already rendered: rows through ui.row, a table, a form.
export default function (_ctx: Context, _session: Session | null, opts: { title: string; right?: string; body: string; empty?: string; class?: string }): string {
    return `<div class="overflow-hidden rounded-md border border-border-subtle ${opts.class ?? ""}">
  <div class="flex items-center justify-between gap-3 bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">
    <span>${esc(opts.title)}</span>${opts.right ?? ""}
  </div>
  ${opts.body || `<div class="border-t border-border-subtle px-4 py-3 text-2xs text-text-tertiary">${esc(opts.empty ?? "nothing here")}</div>`}
</div>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

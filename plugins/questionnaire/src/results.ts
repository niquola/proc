// The search results, as its own fragment so the search box can refresh only
// this list. A row is a link into the preview and a checkbox that adds it to a
// comparison — picking between candidates is the point of searching, so the
// choice is one click away from every hit.
export default function (ctx: Context, _session: Session | null, opts: { query: string; by: string; total: number | null; results: Array<{ id: string; title: string; publisher?: string; status?: string }> }): string {
    if (!opts.query) return `<div id="qr-results" class="mt-4 text-2xs text-text-tertiary">Search the library above — by what a form asks, by its title, or by a LOINC code.</div>`;
    if (!opts.results.length) return `<div id="qr-results" class="mt-4 text-2xs text-text-tertiary">Nothing for <span class="font-mono">${esc(opts.query)}</span>.</div>`;

    // Not ui.row: the whole row is a <label>, so ticking a candidate for the
    // comparison is a click anywhere on it rather than on the box alone.
    const row = (r: { id: string; title: string; publisher?: string; status?: string }) => `<label class="flex items-center gap-3 border-t border-border-subtle px-4 py-2.5 hover:bg-bg-tertiary" ${ctx.fns.ui.attr({ entity: "questionnaire", id: r.id, status: r.status })}>
  <input type="checkbox" name="ids" value="${esc(r.id)}" data-field="compare" class="shrink-0">
  <a class="min-w-0 flex-1 truncate text-text-link hover:underline" href="/questionnaire/preview?id=${encodeURIComponent(r.id)}"
    hx-get="/questionnaire/preview?id=${encodeURIComponent(r.id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true"
    ${ctx.fns.ui.attr({ role: "title" })}>${esc(r.title)}</a>
  <span class="shrink-0 font-mono text-3xs text-text-placeholder" ${ctx.fns.ui.attr({ role: "id" })}>${esc(r.id)}</span>
  ${r.publisher ? `<span class="w-40 shrink-0 truncate text-2xs text-text-tertiary" ${ctx.fns.ui.attr({ role: "publisher" })}>${esc(r.publisher)}</span>` : ""}
</label>`;

    // The form is hand-written for its id: the search box swaps this element by
    // it (hx-target="#qr-results"), so the box lives inside the form.
    return `<form id="qr-results" class="mt-4" ${ctx.fns.ui.attr({ form: "qr-compare" })}
  hx-get="/questionnaire/compare" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">
  ${ctx.fns.ui.box({
        title: `${opts.results.length}${opts.total && opts.total > opts.results.length ? ` of ${opts.total}` : ""} for “${opts.query}” by ${opts.by}`,
        right: ctx.fns.ui.button({ action: "compare", label: "Compare selected" }),
        body: opts.results.map(row).join(""),
    })}
</form>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

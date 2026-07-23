// GET /questionnaire — the project's own forms, and the library search box.
// Both halves answer the same question ("is there already a form for this?"),
// so they live on one page: what we have, then what the world has.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const url = new URL(opts.req.url);
    const query = url.searchParams.get("q") ?? "";
    const by = url.searchParams.get("by") ?? "item";
    const mine = await ctx.fns.questionnaire.local({});
    const found = query ? await ctx.fns.questionnaire.search({ query, by: by as any }).catch(error => ({ total: null, results: [], error })) : { total: null, results: [] };

    const row = (q: { id: string; title: string; file: string; items: number; status?: string }) => `<a class="flex items-center gap-3 border-t border-border-subtle px-4 py-2.5 hover:bg-bg-tertiary"
  href="/questionnaire/preview?id=${encodeURIComponent(q.id)}"
  hx-get="/questionnaire/preview?id=${encodeURIComponent(q.id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true"
  data-entity="questionnaire" data-id="${esc(q.id)}">
  <span class="min-w-0 flex-1 truncate text-text-link">${esc(q.title)}</span>
  <span class="w-40 shrink-0 truncate font-mono text-2xs text-text-tertiary">${esc(q.id)}</span>
  <span class="shrink-0 text-2xs text-text-tertiary">${q.items} questions</span>
</a>`;

    return {
        title: "questionnaires",
        main: `<h1 class="text-lg font-semibold">Questionnaires</h1>
<p class="mt-1 text-2xs text-text-tertiary">Every form in this project is a FHIR Questionnaire kept as <span class="font-mono">$qr_&lt;id&gt;.json</span> beside the code that renders it. Search the public library before writing a new one.</p>

<div class="mt-4 overflow-hidden rounded-md border border-border-subtle">
  <div class="bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">${mine.length} in this project</div>
  ${mine.length ? mine.map(row).join("") : `<div class="border-t border-border-subtle px-4 py-3 text-2xs text-text-tertiary">none yet — import one from the library below</div>`}
</div>

<form class="mt-6 flex items-center gap-2" data-form="qr-search"
  hx-get="/questionnaire/search" hx-target="#qr-results" hx-swap="outerHTML" hx-trigger="submit, change from:select">
  <input name="q" data-field="q" value="${esc(query)}" placeholder="what the form asks about — dental, tobacco, depression…"
    class="flex-1 rounded-md border border-border-input px-3 py-1.5 text-ui outline-none focus:border-border-focus">
  <select name="by" data-field="by" class="rounded-md border border-border-input px-2 py-1.5 text-ui outline-none focus:border-border-focus">
    ${["item", "title", "code"].map(o => `<option value="${o}"${o === by ? " selected" : ""}>${o}</option>`).join("")}
  </select>
  <button class="rounded-md bg-brand px-3 py-1.5 text-ui text-text-inverse hover:bg-brand-hover" data-action="search">Search</button>
</form>
${(found as any).error ? `<div class="mt-4 rounded-md border border-state-danger-border bg-state-danger-bg px-4 py-2 text-ui text-state-danger-fg">${esc(String((found as any).error?.message ?? (found as any).error))}</div>` : ""}
${ctx.fns.questionnaire.results({ query, by, total: found.total, results: found.results })}`,
    };
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

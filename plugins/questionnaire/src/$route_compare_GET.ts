// GET /questionnaire/compare?ids=a,b,c&show=b — the candidates as tabs, one
// rendered at a time.
//
// Side by side sounds like the way to compare and is not: two 32rem columns in a
// half-window pane means both forms are cramped and neither is readable, and a
// form is judged by reading its questions. Tabs give each candidate the whole
// width, and switching costs one swap — the eye compares across a switch better
// than across a scrollbar.
//
// Which one is shown lives in the URL, so the page can be reloaded, shared or
// opened by the workspace at exactly the candidate being talked about.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const url = new URL(opts.req.url);
    const ids = url.searchParams.getAll("ids").join(",").split(",").map(s => s.trim()).filter(Boolean).slice(0, 6);
    if (!ids.length) return { title: "compare", main: ctx.fns.ui.page({ page: "compare", main: `<div class="text-2xs text-text-tertiary">Tick a few results and press Compare.</div>` }) };

    const shown = ids.includes(url.searchParams.get("show") ?? "") ? url.searchParams.get("show")! : ids[0]!;
    const candidates = await Promise.all(ids.map(async id => {
        const questionnaire: any = await ctx.fns.questionnaire.load({ id }).catch(() => null);
        return { id, questionnaire, title: questionnaire?.title ?? id, items: questionnaire ? count(questionnaire.item) : 0 };
    }));
    const current = candidates.find(c => c.id === shown)!;

    const href = (id: string) => `/questionnaire/compare?ids=${encodeURIComponent(ids.join(","))}&show=${encodeURIComponent(id)}`;
    const tab = (c: (typeof candidates)[number]) => `<a class="ui-tab${c.id === shown ? " is-active" : ""}" href="${href(c.id)}"
  hx-get="${href(c.id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true"
  ${ctx.fns.ui.attr({ action: "show", entity: "questionnaire", id: c.id })}
  ><span class="ui-tab__label">${esc(c.title)}</span><span class="text-3xs text-text-placeholder">${c.items}</span></a>`;

    const body = current.questionnaire
        ? (await ctx.fns.questionnaire.render({ questionnaire: current.questionnaire, readOnly: true, formName: `qr-${current.id}-compare` })).main
        : ctx.fns.ui.notice({ text: `${current.id} could not be loaded`, tone: "danger" });

    return {
        title: `compare ${ids.length}`,
        main: ctx.fns.ui.page({
            page: "compare",
            main: `<div class="flex items-baseline justify-between gap-4">
  <h1 class="text-lg font-semibold">Comparing ${candidates.length}</h1>
  <a class="text-2xs text-text-link hover:underline" href="/questionnaire" hx-get="/questionnaire" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">← back</a>
</div>

<div class="mt-4 h-9 border-b border-border-separator">
  <div class="ui-tabbar" role="tablist">${candidates.map(tab).join("")}</div>
</div>

<div ${ctx.fns.ui.attr({ entity: "questionnaire", id: current.id })}>
  <div class="flex items-baseline justify-between gap-3 border-b border-border-subtle px-1 py-2 text-2xs text-text-tertiary">
    <span><span class="font-mono" ${ctx.fns.ui.attr({ role: "id" })}>${esc(current.id)}</span>${current.questionnaire?.publisher ? ` · <span ${ctx.fns.ui.attr({ role: "publisher" })}>${esc(current.questionnaire.publisher)}</span>` : ""} · <span ${ctx.fns.ui.attr({ role: "questions" })}>${current.items} questions</span></span>
    <a class="shrink-0 text-text-link hover:underline" href="/questionnaire/preview?id=${encodeURIComponent(current.id)}"
      hx-get="/questionnaire/preview?id=${encodeURIComponent(current.id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">open</a>
  </div>
  <div class="py-5">${body}</div>
</div>`,
        }),
    };
}

function count(items: any[] = []): number {
    return items.reduce((n, item) => n + (item.type === "group" ? count(item.item) : 1), 0);
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

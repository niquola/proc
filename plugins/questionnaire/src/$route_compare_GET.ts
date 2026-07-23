// GET /questionnaire/compare?ids=a,b,c — the candidates side by side, each
// rendered for real. Two library forms can look identical in a result list and
// ask completely different things; this is the page where the user picks.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const ids = (new URL(opts.req.url).searchParams.getAll("ids").join(",")).split(",").map(s => s.trim()).filter(Boolean).slice(0, 4);
    if (!ids.length) return { title: "compare", main: `<div class="text-2xs text-text-tertiary">Tick a few results and press Compare.</div>` };

    const columns = await Promise.all(ids.map(async id => {
        try {
            const questionnaire = await ctx.fns.questionnaire.load({ id });
            const rendered = await ctx.fns.questionnaire.render({ questionnaire, readOnly: true, formName: `qr-${id}-compare` });
            return { id, title: questionnaire.title ?? id, publisher: questionnaire.publisher, items: count(questionnaire.item), html: rendered.main };
        } catch (error: any) {
            return { id, title: id, items: 0, html: `<div class="text-2xs text-state-danger-fg">${esc(error?.message ?? error)}</div>` };
        }
    }));

    return {
        title: `compare ${ids.length}`,
        main: `<div class="flex items-baseline justify-between gap-4">
  <h1 class="text-lg font-semibold">Comparing ${columns.length}</h1>
  <a class="text-2xs text-text-link hover:underline" href="/questionnaire" hx-get="/questionnaire" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">← back</a>
</div>
<div class="mt-4 flex gap-4 overflow-x-auto">
  ${columns.map(c => `<div class="w-[32rem] shrink-0 overflow-hidden rounded-md border border-border-subtle">
    <div class="flex items-baseline justify-between gap-3 bg-bg-tertiary px-4 py-2 text-3xs text-text-tertiary">
      <span class="truncate font-mono">${esc(c.id)}${c.publisher ? ` · ${esc(c.publisher)}` : ""} · ${c.items} questions</span>
      <a class="shrink-0 text-text-link hover:underline" href="/questionnaire/preview?id=${encodeURIComponent(c.id)}"
        hx-get="/questionnaire/preview?id=${encodeURIComponent(c.id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true"
        data-entity="questionnaire" data-id="${esc(c.id)}">open</a>
    </div>
    <div class="border-t border-border-subtle px-4 py-5">${c.html}</div>
  </div>`).join("")}
</div>`,
    };
}

function count(items: any[] = []): number {
    return items.reduce((n, item) => n + (item.type === "group" ? count(item.item) : 1), 0);
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

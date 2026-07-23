// GET /questionnaire — the project's own forms, and the library search box.
// Both halves answer the same question ("is there already a form for this?"),
// so they live on one page: what we have, then what the world has.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const url = new URL(opts.req.url);
    const query = url.searchParams.get("q") ?? "";
    const by = url.searchParams.get("by") ?? "item";
    const mine = await ctx.fns.questionnaire.local({});
    const found = query ? await ctx.fns.questionnaire.search({ query, by: by as any }).catch(error => ({ total: null, results: [], error })) : { total: null, results: [] };

    const row = (q: { id: string; title: string; file: string; items: number; status?: string }) => ctx.fns.ui.row({
        entity: "questionnaire", id: q.id, status: q.status,
        href: `/questionnaire/preview?id=${encodeURIComponent(q.id)}`,
        cells: [
            { role: "title", text: q.title, class: "min-w-0 flex-1 truncate text-text-link" },
            { role: "id", text: q.id, class: "w-40 shrink-0 truncate font-mono text-2xs text-text-tertiary" },
            { role: "questions", text: `${q.items} questions`, class: "shrink-0 text-2xs text-text-tertiary" },
        ],
    });

    // hx-select is why this form is not ui.form: the response is the whole page
    // and only #qr-results is swapped out of it.
    const search = `<form class="mt-6 flex items-center gap-2" ${ctx.fns.ui.attr({ form: "qr-search" })}
  hx-get="/questionnaire" hx-target="#qr-results" hx-swap="outerHTML" hx-trigger="submit, change from:select"
  hx-select="#qr-results" hx-push-url="true">
  ${ctx.fns.ui.field({ name: "q", value: query, placeholder: "what the form asks about — dental, tobacco, depression…" })}
  ${ctx.fns.ui.field({ name: "by", value: by, options: ["item", "title", "code"], class: "" })}
  ${ctx.fns.ui.button({ action: "search", label: "Search", tone: "primary" })}
</form>`;

    return {
        title: "questionnaires",
        main: ctx.fns.ui.page({
            page: "questionnaires",
            title: "Questionnaires",
            lead: `Every form in this project is a FHIR Questionnaire kept as <span class="font-mono">$qr_&lt;id&gt;.json</span> beside the code that renders it. Search the public library before writing a new one.`,
            main: `
${ctx.fns.ui.box({
                class: "mt-4",
                title: `${mine.length} in this project`,
                body: mine.map(row).join(""),
                empty: "none yet — import one from the library below",
            })}

${search}
${(found as any).error ? `<div class="mt-4">${ctx.fns.ui.notice({ text: String((found as any).error?.message ?? (found as any).error), tone: "danger" })}</div>` : ""}
${ctx.fns.questionnaire.results({ query, by, total: found.total, results: found.results })}`,
        }),
    };
}

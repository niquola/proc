// GET /questionnaire/preview?id=<library-id> | ?file=<project path> — the form
// as the user would see it, plus its JSON. A library candidate is fetched on the
// fly and nothing is saved: previewing is how you decide, not how you import.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const url = new URL(opts.req.url);
    const file = url.searchParams.get("file") ?? undefined;
    const id = url.searchParams.get("id") ?? undefined;
    if (!file && !id) return { title: "questionnaire", status: 400, main: ctx.fns.ui.page({ page: "questionnaire", main: `<div class="text-state-danger-fg">Give a <span class="font-mono">?file=</span> or an <span class="font-mono">?id=</span></div>` }) };

    let questionnaire: any;
    try {
        questionnaire = await ctx.fns.questionnaire.load({ file, id });
    } catch (error: any) {
        return { title: "questionnaire", status: 404, main: ctx.fns.ui.page({ page: "questionnaire", main: ctx.fns.ui.notice({ text: String(error?.message ?? error), tone: "danger" }) }) };
    }

    const rendered = await ctx.fns.questionnaire.render({ questionnaire, readOnly: true, formName: `qr-${id ?? file}` });
    // `load` resolves an id against the project first, so a project form is shown
    // as the file it really is rather than as a library candidate.
    const mine = id ? (await ctx.fns.questionnaire.local({})).find(q => q.id === id) : undefined;
    const source = file || mine ? `<a class="font-mono text-text-link hover:underline" href="/filemanager?path=${encodeURIComponent(file ?? mine!.file)}"
      hx-get="/filemanager?path=${encodeURIComponent(file ?? mine!.file)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">${esc(file ?? mine!.file)}</a>` : `library · <a class="text-text-link hover:underline" href="https://form-builder.aidbox.app/fhir/Questionnaire/${encodeURIComponent(id!)}" target="_blank" rel="noreferrer">form-builder.aidbox.app</a>`;
    // A library candidate can be taken into the project; one that is already a
    // file has nowhere to go.
    const add = file || mine ? "" : ctx.fns.ui.form({
        form: "qr-generate", post: "/questionnaire/generate", class: "mt-4 flex items-center gap-2",
        body: `<input type="hidden" name="id" value="${esc(id)}">
  ${ctx.fns.ui.field({ name: "slug", value: slug(questionnaire, id!), placeholder: "slug", class: "w-64" })}
  ${ctx.fns.ui.button({ action: "generate", id, label: "Add to project", tone: "primary" })}
  <span class="text-2xs text-text-tertiary">writes <span class="font-mono">$qr_&lt;slug&gt;.json</span> and its GET/POST routes</span>`,
    });

    // No heading of our own: formbox renders the form's title inside the form,
    // and the page had it twice. What is left here is what the form does NOT
    // say — where it came from, and that looking at it changes nothing.
    return {
        title: questionnaire.title ?? questionnaire.id ?? "questionnaire",
        main: ctx.fns.ui.page({
            page: "questionnaire",
            // The page shows one questionnaire, so the whole of it is that entity.
            main: `<div ${ctx.fns.ui.attr({ entity: "questionnaire", id: id ?? file, status: questionnaire.status })}>
<div class="flex items-baseline justify-between gap-4 text-2xs text-text-tertiary">
  <div>${source}${questionnaire.publisher ? ` · <span ${ctx.fns.ui.attr({ role: "publisher" })}>${esc(questionnaire.publisher)}</span>` : ""}${questionnaire.status ? ` · <span ${ctx.fns.ui.attr({ role: "status" })}>${esc(questionnaire.status)}</span>` : ""} · read-only, nothing is saved</div>
  <a class="shrink-0 text-text-link hover:underline" href="/questionnaire" hx-get="/questionnaire" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">← back</a>
</div>
${add}
<div class="mt-6">${rendered.main}</div>

<details class="mt-8 overflow-hidden rounded-md border border-border-subtle">
  <summary class="cursor-pointer bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">JSON — <span ${ctx.fns.ui.attr({ role: "questions" })}>${count(questionnaire.item)} questions</span></summary>
  <pre class="overflow-x-auto border-t border-border-subtle p-4 font-mono text-2xs">${esc(JSON.stringify(questionnaire, null, 2))}</pre>
</details>
</div>`,
        }),
    };
}

// A first guess at the slug: the form's own name, or its id — the user edits it
// before pressing the button, and it becomes both the file name and the route.
function slug(questionnaire: any, id: string): string {
    const from = String(questionnaire.name ?? questionnaire.title ?? id);
    return from.trim().replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^a-zA-Z0-9]+/).filter(Boolean).map(w => w.toLowerCase()).slice(0, 4).join("-");
}

function count(items: any[] = []): number {
    return items.reduce((n, item) => n + (item.type === "group" ? count(item.item) : 1), 0);
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

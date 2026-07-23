// POST /questionnaire/generate — put the previewed form into the project. This
// is the one place a preview turns into files, and it takes a deliberate click.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const form = await opts.req.formData();
    const slug = String(form.get("slug") ?? "").trim();
    const id = String(form.get("id") ?? "").trim() || undefined;
    const file = String(form.get("file") ?? "").trim() || undefined;
    const back = (margin: string) => `<a class="${margin} inline-block text-2xs text-text-link hover:underline" href="/questionnaire" hx-get="/questionnaire" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">← questionnaires</a>`;
    try {
        const made = await ctx.fns.questionnaire.generate({ slug, id, file });
        return {
            title: "added",
            main: ctx.fns.ui.page({
                page: "generated",
                title: `${made.slug} is in the project`,
                main: `
${ctx.fns.ui.box({
                    class: "mt-4",
                    title: `${made.files.length} files`,
                    right: `<span class="font-mono">${esc(made.route)}</span>`,
                    body: made.files.map(f => ctx.fns.ui.row({
                        entity: "file", id: f,
                        href: `/filemanager?path=${encodeURIComponent(f)}`,
                        cells: [{ role: "path", text: f, class: "min-w-0 flex-1 truncate font-mono text-2xs text-text-link" }],
                    })).join(""),
                })}
<p class="mt-4 text-2xs text-text-tertiary">The routes are live already — open a patient in the app tab to fill it in.</p>
${back("mt-2")}`,
            }),
        };
    } catch (error: any) {
        return {
            title: "questionnaires",
            status: 400,
            main: ctx.fns.ui.page({
                page: "generated",
                main: `${ctx.fns.ui.notice({ text: String(error?.message ?? error), tone: "danger" })}
${back("mt-4")}`,
            }),
        };
    }
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

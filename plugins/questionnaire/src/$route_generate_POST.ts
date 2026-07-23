// POST /questionnaire/generate — put the previewed form into the project. This
// is the one place a preview turns into files, and it takes a deliberate click.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const form = await opts.req.formData();
    const slug = String(form.get("slug") ?? "").trim();
    const id = String(form.get("id") ?? "").trim() || undefined;
    const file = String(form.get("file") ?? "").trim() || undefined;
    try {
        const made = await ctx.fns.questionnaire.generate({ slug, id, file });
        return {
            title: "added",
            main: `<h1 class="text-lg font-semibold">${esc(made.slug)} is in the project</h1>
<div class="mt-4 overflow-hidden rounded-md border border-border-subtle">
  <div class="bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">${made.files.length} files · <span class="font-mono">${esc(made.route)}</span></div>
  ${made.files.map(f => `<a class="block border-t border-border-subtle px-4 py-2.5 font-mono text-2xs text-text-link hover:bg-bg-tertiary"
    href="/filemanager?path=${encodeURIComponent(f)}" hx-get="/filemanager?path=${encodeURIComponent(f)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">${esc(f)}</a>`).join("")}
</div>
<p class="mt-4 text-2xs text-text-tertiary">The routes are live already — open a patient in the app tab to fill it in.</p>
<a class="mt-2 inline-block text-2xs text-text-link hover:underline" href="/questionnaire" hx-get="/questionnaire" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">← questionnaires</a>`,
        };
    } catch (error: any) {
        return {
            title: "questionnaires",
            status: 400,
            main: `<div class="rounded-md border border-state-danger-border bg-state-danger-bg px-4 py-2 text-ui text-state-danger-fg">${esc(error?.message ?? error)}</div>
<a class="mt-4 inline-block text-2xs text-text-link hover:underline" href="/questionnaire" hx-get="/questionnaire" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">← questionnaires</a>`,
        };
    }
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

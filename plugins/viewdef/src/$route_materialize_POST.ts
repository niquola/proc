// POST /viewdef/materialize — rebuild the table from the file on disk, then show
// the view again so the rows underneath are the new ones.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const id = String((await opts.req.formData()).get("id") ?? "").trim();
    try {
        await ctx.fns.viewdef.materialize({ id });
    } catch (error: any) {
        return {
            title: "views",
            status: 400,
            main: `${ctx.fns.ui.notice({ text: String(error?.message ?? error), tone: "danger" })}
<a class="mt-4 inline-block text-2xs text-text-link hover:underline" href="/viewdef/view?id=${encodeURIComponent(id)}" hx-get="/viewdef/view?id=${encodeURIComponent(id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">← ${esc(id)}</a>`,
        };
    }
    return await ctx.fns.http.dispatch({ url: `/viewdef/view?id=${encodeURIComponent(id)}`, headers: { "HX-Request": "true" } });
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

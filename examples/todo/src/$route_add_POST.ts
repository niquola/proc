// POST /add — add from the form, return the updated list fragment (htmx).
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const form = await opts.req.formData();
    const title = String(form.get("title") ?? "").trim();
    if (title) ctx.add({ title });
    return new Response(ctx.render({}), { headers: { "content-type": "text/html; charset=utf-8" } });
}

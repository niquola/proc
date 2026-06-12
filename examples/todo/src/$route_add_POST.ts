// POST /todo/add — add from the form, return the updated list fragment (htmx).
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const form = await opts.req.formData();
    const title = String(form.get("title") ?? "").trim();
    if (title) ctx.fns.todo.add({ title });
    return fragment(ctx.fns.todo.render({}));
}

function fragment(html: string): Response {
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

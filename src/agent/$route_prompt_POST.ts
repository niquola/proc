// POST /agent/prompt — send the composer's text, answer with the transcript.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const form = await opts.req.formData();
    const text = String(form.get("text") ?? "").trim();
    if (text) await ctx.fns.agent.prompt({ text });
    return new Response(ctx.fns.agent.chat({}), { headers: { "content-type": "text/html; charset=utf-8" } });
}

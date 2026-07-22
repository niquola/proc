// POST /agent/config — the model / reasoning picker: {configId, value}. The
// menu posts it with htmx's hx-vals, which is form-encoded, so the body is read
// either way. Answers with the transcript and the composer's out-of-band
// islands, the same shape prompt, cancel, mode and dequeue answer with, so the
// swap that closes the menu also refreshes the model label.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const type = opts.req.headers.get("content-type") ?? "";
    const body = type.includes("json")
        ? (await opts.req.json()) as { configId?: string; value?: string }
        : Object.fromEntries(await opts.req.formData()) as { configId?: string; value?: string };

    try {
        await ctx.fns.agent.setConfig({ configId: String(body.configId ?? ""), value: String(body.value ?? "") });
    } catch (error: any) {
        return new Response(String(error?.message ?? error), { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    return ctx.fns.chat.reply({});
}

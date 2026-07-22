// POST /agent/mode — the plan-mode toggle. An explicit modeId (form field or
// JSON) sets that mode; no body means flip. Answers with the transcript and the
// composer's out-of-band islands, the same shape prompt, cancel and dequeue
// answer with, so one swap refreshes the whole column.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const type = opts.req.headers.get("content-type") ?? "";
    let modeId: string | undefined;
    if (type.includes("json")) modeId = (await opts.req.json() as { modeId?: string })?.modeId;
    else if (type.includes("form")) modeId = String((await opts.req.formData()).get("modeId") ?? "") || undefined;

    try {
        await ctx.fns.agent.setMode({ modeId });
    } catch (error: any) {
        return new Response(String(error?.message ?? error), { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    return ctx.fns.chat.reply({});
}

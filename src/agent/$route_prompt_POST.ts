// POST /agent/prompt — send the composer's text, answer with the transcript and
// the composer's out-of-band islands, so one swap refreshes the whole column.
// A start that fails because the agent is not logged in is not a server error:
// swallow it, flag the state, and let the chat render its "not connected"
// notice instead of an error page.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const form = await opts.req.formData();
    const text = String(form.get("text") ?? "").trim();
    try {
        if (text) await ctx.fns.agent.prompt({ text });
    } catch (error) {
        if (!ctx.fns.agent.classifyError({ error }).authRequired) throw error;
        const agent = ctx.state.agent;
        agent.status = "offline";
        agent.authRequired = true;
        agent.usageLimit = false;
        agent.promptFailed = false;
        ctx.fns.events.emit({ event: { type: "agent" } });
    }
    return ctx.fns.chat.reply({});
}

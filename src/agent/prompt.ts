// Send a user message to the agent; updates stream back through receive().
export default async function (ctx: Context, _session: Session | null, opts: { text: string }) {
    const agent = ctx.state.agent;
    if (!agent?.acp) await ctx.fns.agent.start({});
    const live = ctx.state.agent;
    if (!live.acp) return { status: live.status, error: live.error };

    live.messages.push({ id: crypto.randomUUID(), role: "user", kind: "text", text: opts.text, at: new Date().toISOString() });
    live.status = "running";
    ctx.fns.events.emit({ event: { type: "agent" } });

    // Don't block the request: the answer arrives as session updates.
    void live.acp.prompt({ sessionId: live.session, prompt: [{ type: "text", text: opts.text }] })
        .then(() => { live.status = "idle"; ctx.fns.events.emit({ event: { type: "agent" } }); })
        .catch((error: any) => {
            live.status = "idle";
            live.error = String(error?.message ?? error);
            ctx.fns.events.emit({ event: { type: "agent" } });
        });

    return { status: live.status };
}

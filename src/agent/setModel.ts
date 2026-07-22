// Switch the running session to another model (ACP session config option).
export default async function (ctx: Context, _session: Session | null, opts: { model: string }) {
    const agent = ctx.state.agent;
    if (!agent?.acp) throw new Error("agent is not running");
    await agent.acp.setSessionConfigOption({ sessionId: agent.session, configId: "model", value: opts.model });
    ctx.fns.events.emit({ event: { type: "agent" } });
    return ctx.fns.agent.models({});
}

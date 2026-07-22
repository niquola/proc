// Kill the agent process and forget the session.
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const agent = ctx.state.agent;
    if (!agent?.process) return { status: "offline" };
    agent.process.kill();
    await agent.process.exited;
    agent.acp = undefined;
    agent.session = undefined;
    agent.status = "offline";
    ctx.fns.events.emit({ event: { type: "agent" } });
    return { status: "offline" };
}

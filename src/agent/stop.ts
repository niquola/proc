// Close the session politely, then kill the process. The state is not touched
// here: proc.exited fires handleExit, which clears the connection and keeps the
// session id — so a later start restores this conversation instead of a new one.
// Awaiting `exited` is what makes stop deterministic for callers ($stop, restart).
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const agent = ctx.state.agent;
    if (!agent?.process) return { status: "offline" };

    await ctx.fns.agent.closeSession({});
    const proc = agent.process;
    try { proc.kill(); } catch { }
    await proc.exited;
    ctx.fns.log.info({ event: "agent.stopped", msg: "agent stopped" });
    return { status: "offline" };
}

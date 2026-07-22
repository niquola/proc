// Ask the agent to close the current session gracefully. Optional on both
// sides: not every agent advertises sessionCapabilities.close, and a close that
// fails changes nothing we care about — the caller is about to kill the process
// or recycle the session anyway. So the failure is logged, never thrown.
// The 10s budget lives in callAcp's table.
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const agent = ctx.state.agent;
    if (!agent?.acp || !agent.session || !agent.capabilities?.sessionCapabilities?.close) return { closed: false };

    try {
        await ctx.fns.agent.callAcp({ method: "closeSession", params: { sessionId: agent.session } });
        ctx.fns.log.info({ event: "agent.session.closed", msg: "ACP session closed", session: agent.session });
        return { closed: true };
    } catch (error: any) {
        ctx.fns.log.info({ event: "agent.session.close.failed", msg: `closeSession: ${error?.message ?? error}`, session: agent.session });
        return { closed: false };
    }
}

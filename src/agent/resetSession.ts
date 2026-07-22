// Recycle the session in place after a prompt the agent cannot digest (a 400,
// an image it rejects, a context too large). The process and the connection are
// fine — only the conversation is poisoned — so we close the session, drop
// everything scoped to it and open a new one over the same acp.
// totals.agentMs is workspace-lifetime, not session-scoped, so it survives.
// On failure we still saveState: the old session id is gone either way, and
// persisting it would make the next boot try to restore a dead session.
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const agent = ctx.state.agent;
    if (!agent?.acp) return { ok: false };

    ctx.fns.log.info({ event: "agent.session.reset", msg: "resetting session after prompt failure", session: agent.session });
    await ctx.fns.agent.closeSession({});

    agent.session = undefined;
    delete agent.currentModeId;
    delete agent.config;
    delete agent.usage;

    try {
        await ctx.fns.agent.openSession({});
        return { ok: true };
    } catch (error: any) {
        ctx.fns.log.info({ event: "agent.session.reset.failed", msg: `reset: ${error?.message ?? error}` });
        ctx.fns.agent.saveState({});
        return { ok: false };
    }
}

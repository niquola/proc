// Reattach to the session that survived the last shutdown. The agent replays
// the whole transcript as session updates while loading it — we already have
// those rows in sqlite, so `loading` tells receive to drop them; it is cleared
// in finally, or a timed-out restore would silence the agent for good.
// A failed restore is not fatal: the session id is dead, so we forget it and
// report false, and start opens a fresh one. Auth is the exception — a fresh
// session would fail the same way, so it goes up to the caller.
// `acp` is passed in because start commits the connection only after the
// session exists.
export default async function (ctx: Context, _session: Session | null, opts: { acp?: any } = {}) {
    const agent = ctx.state.agent;
    const cwd = ctx.fns.project.workdir({});
    ctx.fns.log.info({ event: "agent.session.restore", msg: agent.session, session: agent.session });

    try {
        agent.loading = true;
        let restored: any;
        try {
            restored = await ctx.fns.agent.callAcp({
                method: "loadSession",
                params: { sessionId: agent.session, cwd, mcpServers: [] },
                acp: opts.acp,
            });
        } finally {
            agent.loading = false;
        }

        if (restored?.configOptions) agent.config = restored.configOptions;
        if (restored?.modes) {
            agent.modes = restored.modes;
            agent.currentModeId = restored.modes.currentModeId;
        }
        ctx.fns.agent.settleTools({});

        ctx.fns.log.info({ event: "agent.session.restored", msg: agent.session, session: agent.session });
        return { ok: true };
    } catch (error) {
        const kind = ctx.fns.agent.classifyError({ error });
        if (kind.authRequired) throw error;

        ctx.fns.log.warn({ event: "agent.session.restore.failed", msg: kind.message, session: agent.session });
        agent.session = undefined;
        ctx.fns.agent.saveState({});
        return { ok: false };
    }
}

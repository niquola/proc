// Create a fresh ACP session over WORKDIR. Called by start when there is
// nothing to restore, and by resetSession after a poisoned prompt — hence the
// `acp` opt: during start the connection is committed to state only after the
// session exists, so the caller passes it in.
// The session id is saved here rather than at shutdown: it is what makes
// restore possible, and a crash before the next save would orphan a live
// session and start the next boot from scratch.
export default async function (ctx: Context, _session: Session | null, opts: { acp?: any } = {}) {
    const agent = ctx.state.agent;
    const cwd = ctx.fns.project.workdir({});
    const created = await ctx.fns.agent.callAcp({ method: "newSession", params: { cwd, mcpServers: [] }, acp: opts.acp });

    agent.session = created.sessionId;
    if (created.configOptions) agent.config = created.configOptions;
    // wmlet reads only configOptions off this response and drops the mode state
    // it carries, so its mode picker stays empty until the agent pushes an
    // update. Take both.
    if (created.modes) {
        agent.modes = created.modes;
        agent.currentModeId = created.modes.currentModeId;
    }
    ctx.fns.agent.saveState({});

    ctx.fns.log.info({ event: "agent.session.opened", msg: created.sessionId, session: created.sessionId, cwd });
    return { session: created.sessionId as string };
}

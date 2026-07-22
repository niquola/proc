// Switch the session mode — this is the plan-mode toggle. ACP answers with
// nothing, so unlike setConfig there is no authoritative list to adopt: the mode
// we asked for is the mode we record, and the agent corrects us with a
// current_mode_update if it disagrees.
// Without a modeId this flips plan ⇄ default, so the toggle stays server-decided
// — the client never has to read the current mode back out of the DOM.
export default async function (ctx: Context, _session: Session | null, opts: { modeId?: string } = {}) {
    const agent = ctx.state.agent;
    if (!agent?.acp || !agent.session) throw new Error("agent is not running");

    const modeId = opts.modeId || (agent.currentModeId === "plan" ? "default" : "plan");
    await ctx.fns.agent.callAcp({ method: "setSessionMode", params: { sessionId: agent.session, modeId } });

    agent.currentModeId = modeId;
    ctx.fns.log.info({ event: "agent.mode", msg: modeId, modeId });
    ctx.fns.events.emit({ event: { type: "agent" } });
    return { currentModeId: modeId };
}

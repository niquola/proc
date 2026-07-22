// Cancel the turn in flight. The ACP cancel makes the agent end the prompt, so
// the in-flight promise settles on its own and finishPrompt does the rest —
// nothing here touches status.
//
// It deliberately does NOT clear the queue: cancel means "stop this turn", and
// the next queued message starts right after. Clearing the queue here would
// silently drop messages the user already sent. Cancel twice to skip two turns.
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const agent = ctx.state.agent;
    if (agent?.status !== "running") throw new Error("no running prompt");
    if (!agent.acp || !agent.session) throw new Error("agent is not running");

    // Close the think span before the round trip, so the wait is not billed.
    ctx.fns.agent.trackTiming({ close: true });
    await ctx.fns.agent.callAcp({ method: "cancel", params: { sessionId: agent.session } });
    ctx.fns.log.info({ event: "agent.cancel", msg: "turn cancelled", session: agent.session, queued: agent.queue.length });
    return { ok: true };
}

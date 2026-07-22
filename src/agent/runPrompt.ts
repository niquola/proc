// The turn body. The branching below is the policy, not a shape to generalise:
// usage limit and auth are independent facts (a limited turn can also be
// unauthenticated), a resettable error earns exactly one retry on a fresh
// session, and everything else is a plain failure. The retry error is not
// re-classified — a second failure means the prompt is bad, not the session.
//
// finishPrompt is in finally, so the queue drains and the status leaves
// "running" after success, failure, reset, retry and cancel alike.
export default async function (ctx: Context, _session: Session | null, opts: { text: string }): Promise<void> {
    const agent = ctx.state.agent;
    const params = { sessionId: agent?.session, prompt: [{ type: "text", text: opts.text }] };

    try {
        // A turn with nowhere to go must fail, not vanish: resetSession can leave
        // the connection live with no session, and a silent no-op there would
        // publish the user message, flip to running and settle back to idle with
        // no answer and no flag — forever.
        if (!agent?.acp || !agent.session) throw new Error("agent has no session");
        ctx.fns.log.info({ event: "agent.prompt", msg: "prompt start", session: agent.session, chars: opts.text.length });
        await ctx.fns.agent.callAcp({ method: "prompt", params });
        ctx.fns.log.info({ event: "agent.prompt.done", msg: "prompt delivered", session: agent.session });
    } catch (error) {
        const failure = ctx.fns.agent.classifyError({ error });
        ctx.fns.log.warn({ event: "agent.prompt.failed", msg: failure.message });

        if (failure.usageLimit) {
            agent.usageLimit = true;
            ctx.fns.events.emit({ event: { type: "agent" } });
        }

        if (failure.authRequired) {
            agent.authRequired = true;
            ctx.fns.events.emit({ event: { type: "agent" } });
        } else if (!failure.usageLimit) {
            const reset = failure.resettable && (await ctx.fns.agent.resetSession({})).ok;
            if (reset && agent.acp && agent.session) {
                try {
                    ctx.fns.log.info({ event: "agent.prompt.retry", msg: "retry after session reset", session: agent.session });
                    await ctx.fns.agent.callAcp({ method: "prompt", params: { ...params, sessionId: agent.session } });
                    ctx.fns.log.info({ event: "agent.prompt.done", msg: "prompt delivered after retry", session: agent.session });
                } catch (retryError: any) {
                    ctx.fns.log.warn({ event: "agent.prompt.retry.failed", msg: String(retryError?.message ?? retryError) });
                    agent.promptFailed = true;
                    ctx.fns.events.emit({ event: { type: "agent" } });
                }
            } else {
                agent.promptFailed = true;
                ctx.fns.events.emit({ event: { type: "agent" } });
            }
        }
    } finally {
        await ctx.fns.agent.finishPrompt({});
    }
}

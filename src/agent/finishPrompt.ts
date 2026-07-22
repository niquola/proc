// The end of a turn, however it ended — success, failure, auth, usage limit or
// cancel. One queued message is drained here and nowhere else, so exactly one
// turn is ever in flight. It goes through sendPrompt rather than prompt, because
// prompt is the queue-aware entry point and would just enqueue the item again.
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const agent = ctx.state.agent;
    if (!agent) return;

    // A turn ending on a thought leaves the think span open; closing it here
    // keeps the idle gap until the next turn out of totals.agentMs. The total is
    // final for the turn, so this is where it is persisted — otherwise agent_ms
    // would restore as 0 no matter how long the agent worked.
    ctx.fns.agent.trackTiming({ close: true });
    ctx.fns.agent.saveState({});
    delete agent.prompt;

    const next = agent.queue.shift();
    if (next) {
        ctx.fns.agent.sendPrompt({ text: next.text });
        return;
    }

    agent.status = "idle";
    ctx.fns.events.emit({ event: { type: "agent" } });
}

// Bill agent wall-clock time into totals.agentMs. Two kinds of span are tracked:
// the thinking span (opened by the first thought chunk, closed by the next update
// of any other kind) and one span per tool call (opened on its first non-terminal
// update, closed when it reaches completed/failed). Elapsed bounds are stamped
// onto the update itself as _startedAt/_completedAt, so the payload we persist
// carries its own timing — call this before publish, not after.
//
// { close: true } closes a dangling think span. Without it a turn that ends on a
// thought leaves the span open and bills the whole idle gap to the next update,
// which is why finishPrompt, cancel and handleExit all call it.
export default function (ctx: Context, _session: Session | null, opts: { update?: any; close?: boolean }) {
    const agent = ctx.state.agent;
    const u = opts.update;
    const now = Date.now();

    if (!opts.close && u?.sessionUpdate === "agent_thought_chunk") {
        agent.thinkStartedAt ??= now;
    } else if (agent.thinkStartedAt !== undefined) {
        const elapsed = now - agent.thinkStartedAt;
        if (elapsed > 0) agent.totals.agentMs += elapsed;
        agent.thinkStartedAt = undefined;
    }

    if (u?.sessionUpdate !== "tool_call" && u?.sessionUpdate !== "tool_call_update") return;

    const started = agent.toolStartedAt[u.toolCallId];
    if (u.status !== "completed" && u.status !== "failed") {
        u._startedAt = agent.toolStartedAt[u.toolCallId] = started ?? now;
        return;
    }

    u._completedAt = now;
    // A tool we never saw start (restored session, missed first update) gets an
    // end stamp but no billing — there is no honest duration to add.
    if (started === undefined) return;
    u._startedAt = started;
    const elapsed = now - started;
    if (elapsed > 0) agent.totals.agentMs += elapsed;
    delete agent.toolStartedAt[u.toolCallId];
}

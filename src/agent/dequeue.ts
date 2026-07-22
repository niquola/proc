// Drop one queued message by id and hand back its text. The queue is drained in
// exactly one other place (finishPrompt), so removal is a plain splice here.
// Returning the text is what makes edit-pullback possible: the row's edit button
// deletes the item and the composer is refilled with what it said. An unknown id
// is not an error — the item was already sent — so it answers with "".
export default function (ctx: Context, _session: Session | null, opts: { id: string }): string {
    const agent = ctx.state.agent;
    if (!agent) return "";

    const at = agent.queue.findIndex(item => item.id === opts.id);
    if (at < 0) return "";

    const removed = agent.queue.splice(at, 1)[0]!;
    ctx.fns.events.emit({ event: { type: "agent" } });
    return removed.text;
}

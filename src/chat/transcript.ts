// `#chat` — the scrolling transcript, and the only element the page ever swaps.
// Every `{type:"agent"}` event refetches it and htmx replaces it outerHTML, so
// the notice and the run state ride inside it instead of being separate islands.
//
// Consecutive `role === "agent"` messages are one turn: one wrapper, one
// timestamp at the bottom, the blocks stacked inside. Within a turn each message
// goes to the fn that renders its kind, and a run of tool calls collapses into a
// single pill. The db has no turn id — the walk below is the whole grouping.
export default function (ctx: Context, _session: Session | null, opts?: { oob?: boolean }): string {
    const messages: types.agent.Message[] = ctx.fns.agent.messages({});
    const blocks: string[] = [];
    for (let i = 0; i < messages.length; i += 1) {
        const message = messages[i]!;
        if (message.role !== "agent") {
            blocks.push(ctx.fns.chat.bubble({ message }));
            continue;
        }
        const group: types.agent.Message[] = [message];
        while (messages[i + 1]?.role === "agent") {
            i += 1;
            group.push(messages[i]!);
        }
        blocks.push(turn(ctx, group));
    }
    // wmlet's `scroll-behavior: smooth` is dropped on purpose: it streamed
    // messages into a live scroller, while every agent event replaces this whole
    // element, so a smooth pin would animate from the top on each chunk — and a
    // programmatic scroll set on a brand-new node never lands at all.
    return `<div id="chat"${opts?.oob ? ` hx-swap-oob="true"` : ""} class="h-full overflow-y-auto p-4"
  hx-on--load="if (event.target === this) window.chat.scroll(this)">
  <div class="space-y-4" style="overflow-anchor: none;">${blocks.join("")}</div>
${ctx.fns.chat.notice({})}
${ctx.fns.chat.runState({})}
  <div class="h-px" style="overflow-anchor: auto;" aria-hidden="true"></div>
</div>`;
}

// One agent turn. Tool calls that sit next to each other are one pill; the
// timestamp is the latest edit anywhere in the turn, so a streaming reply keeps
// moving its own clock instead of leaving a stale one per block.
function turn(ctx: Context, messages: types.agent.Message[]): string {
    const blocks: string[] = [];
    for (let i = 0; i < messages.length; i += 1) {
        const message = messages[i]!;
        if (message.kind === "tool") {
            const run: types.agent.Message[] = [message];
            while (messages[i + 1]?.kind === "tool") {
                i += 1;
                run.push(messages[i]!);
            }
            blocks.push(ctx.fns.chat.tools({ messages: run }));
        } else if (message.kind === "thought") {
            blocks.push(ctx.fns.chat.thought({ message }));
        } else if (message.kind === "plan") {
            blocks.push(ctx.fns.chat.plan({ entries: message.data?.entries }));
        } else {
            blocks.push(ctx.fns.chat.answer({ message }));
        }
    }
    const updatedAt = messages.reduce<string | undefined>(
        (latest, message) => (message.updatedAt && (!latest || message.updatedAt > latest) ? message.updatedAt : latest),
        undefined,
    );
    return `<div class="assistant-turn flex flex-col gap-2 max-w-3xl">
  <div class="assistant-turn-blocks flex flex-col gap-2">${blocks.join("")}</div>
  <div class="assistant-timestamp font-mono text-3xs font-medium uppercase tracking-eyebrow text-text-tertiary">${time(ctx, updatedAt)}</div>
</div>`;
}

function time(ctx: Context, updatedAt?: string): string {
    const parsed = updatedAt ? new Date(updatedAt) : new Date();
    const at = Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
    const label = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
    return updatedAt
        ? `<time datetime="${ctx.fns.chat.escape({ text: updatedAt })}">${label}</time>`
        : `<span>${label}</span>`;
}

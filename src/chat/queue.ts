// The queued-prompts bar: what you typed while the agent was busy, waiting its
// turn. It sits directly above the compose box and is welded to it — `-mb-px`
// eats the shared border so the two read as one control — and hides itself
// entirely when the queue is empty.
//
// Each row is text plus two buttons. Delete is a plain `hx-delete` to
// DELETE /agent/queue/:id targeting `#chat`, so the response's OOB islands
// (this bar included) land in the same swap. Edit is the same delete, preceded
// by a click handler that writes the text back into the composer — the text
// travels as a JSON literal argument, never read back out of the DOM.
//
// wmlet's drag handle and /queue/reorder are dropped: the queue is a FIFO that
// finishPrompt drains one at a time.
export default function (ctx: Context, _session: Session | null, opts: { oob?: boolean } = {}): string {
    const queue = ctx.state.agent?.queue ?? [];
    const rows = queue.length === 0
        ? `<div class="px-3 py-2 text-xs text-text-placeholder">Empty</div>`
        : queue.map(item => {
            const id = ctx.fns.chat.escape({ text: item.id });
            const text = ctx.fns.chat.escape({ text: item.text });
            const remove = `hx-delete="/agent/queue/${id}" hx-target="#chat" hx-swap="outerHTML"`;
            const arg = ctx.fns.chat.escape({ text: JSON.stringify({ text: item.text }) });
            return `<div class="flex items-center px-1 py-1 text-xs text-text-heading" data-entity="queue" data-id="${id}">
      <span class="min-w-0 flex-1 truncate px-1 py-1 text-xs text-text-primary" title="${text}">${text}</span>
      <button type="button" data-action="edit" class="inline-flex h-6 w-6 items-center justify-center rounded cursor-pointer text-text-tertiary hover:text-text-primary" title="Edit"
        hx-on:click="window.chat.edit(this, ${arg})" ${remove}><i class="ph ph-pencil-simple text-2xs" aria-hidden="true"></i></button>
      <button type="button" data-action="dequeue" class="inline-flex h-6 w-6 items-center justify-center rounded cursor-pointer text-text-tertiary hover:text-state-danger-fg" title="Delete"
        ${remove}><i class="ph ph-trash text-2xs" aria-hidden="true"></i></button>
    </div>`;
        }).join("\n");
    return `<div id="queue"${opts.oob ? ` hx-swap-oob="true"` : ""} class="mx-4 -mb-px rounded-t-lg border border-border-input bg-bg-quaternary overflow-hidden${queue.length === 0 ? " hidden" : ""}">
    <div class="divide-y divide-border-input">
${rows}
    </div>
  </div>`;
}

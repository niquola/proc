// One `kind:"thought"` message: the agent's thinking, collapsed. Same row as a
// tool action in wmlet (brain icon, title, elapsed, chevron) — here it is a
// standalone message instead of the synthetic `agent-thought-*` tool call, since
// publish.ts already keeps thinking as its own row.
//
// The elapsed label is `updatedAt - at`: a thought row opens on its first chunk
// and its updatedAt moves with every chunk after, so the span is the message.
// Empty thinking renders nothing, the way wmlet drops an empty think view.
export default function (ctx: Context, _session: Session | null, opts: { message: types.agent.Message }): string {
    const text = opts.message.text ?? "";
    if (!text.trim()) return "";
    // The button is handed the text; it never reads the block back out.
    const payload = ctx.fns.chat.escape({ text: JSON.stringify({ text }) });
    const ms = Date.parse(opts.message.updatedAt) - Date.parse(opts.message.at);
    const elapsed = Number.isFinite(ms) && ms > 0 ? formatDuration(ms) : "";
    return `<details class="group tool-action-row" name="chat-thought">
  <summary class="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-bg-tertiary group-open:bg-bg-tertiary">
    <i class="ph ph-brain text-[15px] shrink-0 text-text-muted" aria-hidden="true"></i>
    <span class="min-w-0 flex-1 truncate text-ui text-text-primary" title="Thinking">Thinking</span>
    <span class="flex shrink-0 items-center gap-1.5">
${elapsed ? `      <span class="text-2xs text-text-tertiary tabular-nums">${elapsed}</span>\n` : ""}      <i class="tool-action-chevron ph ph-caret-right text-text-placeholder transition-transform duration-150 group-open:rotate-90" aria-hidden="true"></i>
    </span>
  </summary>
  <div class="space-y-2 px-3 pb-3 pl-10 mt-2">
    <div class="tool-text-block">
      <div class="mb-1 flex items-center justify-between gap-2">
        <div class="text-2xs font-medium text-text-tertiary">Thought</div>
        <button type="button"
          class="inline-flex size-6 items-center justify-center rounded text-text-tertiary hover:bg-bg-quaternary hover:text-text-primary"
          title="Copy Thought" aria-label="Copy Thought"
          data-action="copy" hx-on:click="window.chat.copy(this, ${payload})">
          <i class="ph ph-copy-simple text-3xs" aria-hidden="true"></i>
        </button>
      </div>
      <pre class="tool-output overflow-x-auto rounded border border-border-subtle bg-bg-tertiary px-2 py-1.5 font-mono text-2xs leading-4 text-text-muted">${ctx.fns.chat.escape({ text })}</pre>
    </div>
  </div>
</details>`;
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds - minutes * 60);
    return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

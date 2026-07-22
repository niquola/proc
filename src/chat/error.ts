// The danger banner. One shape for every error the chat shows — the notice
// (auth required / usage limit / prompt failed) and any agent error text.
// Server-rendered inside `#chat`, so it is replaced by the next swap instead of
// accumulating at the bottom of the transcript.
export default function (ctx: Context, _session: Session | null, opts: { message: string }): string {
    return `<div class="max-w-3xl my-2 rounded-md border border-state-danger-border bg-state-danger-bg px-3 py-2 text-xs text-state-danger-fg">
  <div class="flex items-center gap-2">
    <i class="ph ph-warning text-state-danger-fg" aria-hidden="true"></i>
    <span class="font-semibold">Error</span>
  </div>
  <div class="mt-1 whitespace-pre-wrap text-state-danger-fg">${ctx.fns.chat.escape({ text: opts.message })}</div>
</div>`;
}

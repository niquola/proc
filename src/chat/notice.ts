// The one banner above the transcript. Exactly one of the three orthogonal
// agent flags is shown, in the priority wmlet uses: authRequired (nothing else
// matters until the agent is connected) > usageLimit > promptFailed. The
// wrapper div always renders, so the transcript's layout does not jump when a
// flag flips; it lives inside `#chat`, which is swapped whole on every event.
export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    const agent = ctx.state.agent;
    const name = agent?.id === "codex" ? "Codex" : "Claude";
    const notice = agent?.authRequired
        ? `<div id="auth-prompt" class="mx-auto max-w-md my-6 p-5 bg-state-warning-bg border border-state-warning-border rounded-lg">
  <div class="flex items-start gap-3">
    <i class="ph ph-key text-state-warning-fg mt-0.5" aria-hidden="true"></i>
    <div class="flex-1">
      <h4 class="text-sm font-semibold text-state-warning-fg mb-1">${ctx.fns.chat.escape({ text: name })} is not connected</h4>
      <p class="text-xs text-state-warning-fg">
        Sign in to ${ctx.fns.chat.escape({ text: name })} in a terminal in this workspace. Restart the agent after connecting.
      </p>
    </div>
  </div>
</div>`
        : agent?.usageLimit
            ? ctx.fns.chat.error({ message: "The agent hit its usage limit." })
            : agent?.promptFailed
                ? ctx.fns.chat.error({ message: "The agent prompt failed." })
                : "";
    return `<div id="chat-notice">${notice}</div>`;
}

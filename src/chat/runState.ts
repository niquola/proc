// The line under the transcript that says what the agent is doing: a spinner
// with "Working" while a turn runs, "Starting" while the session boots,
// "Offline" when there is no connection, and nothing at all when idle.
//
// `data-agent-status` mirrors `agent.status` for page.click/probing only — no
// client JS reads it. The send/stop button is server-rendered in
// ctx.fns.chat.send({}) from the same status, so nothing here has to know.
export default function (ctx: Context, _session: Session | null, opts: { oob?: boolean }): string {
    const status = ctx.state.agent?.status ?? "offline";
    const content =
        status === "running"
            ? `<span class="inline-flex items-center gap-1.5 text-text-muted">
      <span class="inline-block w-3 h-3 border-2 border-border-input border-t-text-tertiary rounded-full animate-spin" aria-hidden="true"></span>
      <span>Working</span>
    </span>`
            : status === "starting"
              ? `<span class="text-text-link">
      <span class="inline-block w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin"></span> Starting
    </span>`
              : status === "offline"
                ? `<span class="text-text-placeholder">Offline</span>`
                : "";
    return `<div id="run-state"${opts.oob ? ` hx-swap-oob="true"` : ""} class="mt-3 text-xs text-text-placeholder" data-agent-status="${ctx.fns.chat.escape({ text: status })}">
    ${content}
  </div>`;
}

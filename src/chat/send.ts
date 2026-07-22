// The round accent button at the right of the composer's control row: send
// while the agent is idle, stop while a turn runs.
//
// wmlet flipped this in the browser (`syncTopicStatusFromDom` read
// `#run-state[data-topic-status]` and rewrote the button). Here the server owns
// it: `agent.status` decides which of the two buttons is rendered, and the
// `#send` island is swapped out of band by every response that can change the
// status. No client JS knows anything about running.
//
// The only thing the browser still decides is emptiness — `window.chat.compose`
// toggles `disabled` on `[data-action="send"]` as the textarea fills and empties,
// which is why the send variant renders disabled (the box starts empty).
export default function (ctx: Context, _session: Session | null, opts: { oob?: boolean }): string {
    const oob = opts.oob ? ` hx-swap-oob="true"` : "";
    if (ctx.state.agent?.status === "running") {
        return `<button type="button" id="send"${oob} class="ui-btn-send" title="Stop" aria-label="Stop" data-action="stop"
      hx-post="/agent/cancel" hx-target="#chat" hx-swap="outerHTML">
      <i class="ph ph-square text-2xs" aria-hidden="true"></i>
    </button>`;
    }
    return `<button type="submit" id="send"${oob} class="ui-btn-send" title="Send" aria-label="Send" data-action="send" disabled aria-disabled="true">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12l7-7 7 7"/></svg>
    </button>`;
}

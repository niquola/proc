// `#service-log` — the output of one service: a header with its name, its state
// and the tail toggle, over a monospace scroller.
//
// The scroller is pre-filled server-side with the last 500 lines of the ring and
// carries the seq of the last of them; `window.processes.logs` opens the SSE
// stream from exactly there, so the ring stays the transcript and the stream is
// only a cursor over it — nothing is replayed and nothing is missed.
//
// Selecting a card swaps this whole element (`hx-target="#service-log"`), which
// is why the URL and the cursor are handed to the client as explicit arguments:
// the fresh element is wired on load, and the previous EventSource is closed by
// the client itself.
const TAIL = 500;

export default function (ctx: Context, _session: Session | null, opts: { name?: string }): string {
    const service: types.services.Service | undefined = opts.name ? ctx.state.services?.[opts.name] : undefined;
    if (!service) {
        return `<div id="service-log" class="min-h-0 flex-1 flex items-center justify-center border-t border-border-subtle bg-bg-content text-ui text-text-placeholder">Select a service to read its output</div>`;
    }

    const lines: types.services.Line[] = ctx.fns.services.logs({ name: service.name, lines: TAIL });
    const wire = ctx.fns.processes.escape({
        text: JSON.stringify({ url: `/processes/${encodeURIComponent(service.name)}/logs/stream`, from: lines.at(-1)?.seq ?? 0 }),
    });
    const body = lines.map(line => `<div class="${line.stream === "err" ? "text-state-danger-fg" : "text-text-primary"}">${ctx.fns.processes.escape({ text: line.text })}</div>`).join("");

    return `<div id="service-log" class="min-h-0 flex-1 flex flex-col border-t border-border-subtle bg-bg-content">
  <div class="ui-pane-header gap-3 px-4">
    <span class="font-mono text-ui text-text-primary truncate">${ctx.fns.processes.escape({ text: service.name })}</span>
${chip(service.state)}
    <span class="flex-1"></span>
    <button type="button" data-action="tail" title="Follow output" class="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-tint-hover hover:text-text-primary"
      hx-on:click="window.processes.tail(this)">
      <i class="ph ph-arrow-down text-base" aria-hidden="true"></i>
    </button>
  </div>
  <div class="min-h-0 flex-1 overflow-y-auto px-4 py-2 font-mono text-2xs leading-5 whitespace-pre-wrap break-all"
    hx-on--load="window.processes.logs(this, ${wire})">${body}</div>
</div>`;
}

// The state chip, the same trio of tokens the cards use: the layout ships the
// `state-*` colours but no chip class, so it is three Tailwind utilities.
function chip(state: string): string {
    const tone = state === "running" ? "success" : state === "crashed" ? "danger" : state === "idle" ? "neutral" : "warning";
    return `    <span class="inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-3xs font-medium uppercase tracking-label bg-state-${tone}-bg border-state-${tone}-border text-state-${tone}-fg">${state}</span>`;
}

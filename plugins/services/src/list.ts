// `#service-list` — the scroller the cards live in.
//
// It refetches its own contents, so the list is the only thing that has to know
// how to refresh: every five seconds for the uptimes, and immediately on
// `refresh`, which `window.processes.watch` fires when the supervisor emits
// `{type:"service"}`. The swap is `innerHTML` and the target is `this`: the
// element itself is never replaced, so its scroll position and its timer stay
// put — and `hx-target` is explicit because the right pane sets `hx-boost` with
// a target of `#main`, which children inherit.
//
// Its own URL carries the selection, so an action button that renders nothing at
// all still leaves the right card highlighted.
export default function (ctx: Context, _session: Session | null, opts: { selected?: string; oob?: boolean }): string {
    const url = `/processes/list${opts.selected ? `?name=${encodeURIComponent(opts.selected)}` : ""}`;
    return `<div id="service-list"${opts.oob ? ` hx-swap-oob="true"` : ""} class="max-h-[45%] shrink-0 overflow-y-auto bg-bg-content"
  hx-get="${url}" hx-trigger="every 5s, refresh" hx-target="this" hx-swap="innerHTML"
  hx-on--load="window.processes.watch(this)">${ctx.fns.processes.cards({ selected: opts.selected })}</div>`;
}

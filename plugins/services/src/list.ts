// `#service-list` — every declared service as a card, the interesting ones
// first: what is running, then what crashed (the thing you opened this tab for),
// then the rest, alphabetically inside each group.
//
// It refetches itself, so the list is the only thing that has to know how to
// refresh: every five seconds for the uptimes, and immediately on `refresh`,
// which `window.processes.watch` fires when the supervisor emits
// `{type:"service"}`. Its own URL carries the selection, so an action button
// that renders nothing at all still leaves the right card highlighted — and
// selecting a card ships a fresh copy out of band, which is what moves that
// selection into the URL the list will poll with next.
const RANK: Record<string, number> = { running: 0, starting: 1, restarting: 1, crashed: 2, idle: 3 };

export default function (ctx: Context, _session: Session | null, opts: { selected?: string; oob?: boolean }): string {
    const selected = opts.selected;
    const services = Object.values(ctx.state.services ?? {})
        .sort((a, b) => (RANK[a.state]! - RANK[b.state]!) || a.name.localeCompare(b.name));
    const url = `/processes/list${selected ? `?name=${encodeURIComponent(selected)}` : ""}`;

    const cards = services.length
        ? services.map(service => ctx.fns.processes.card({ service, selected: service.name === selected })).join("")
        : `<div class="px-3 py-6 text-center text-ui text-text-placeholder">No services — add one to <code>workspace.json</code>.</div>`;

    return `<div id="service-list"${opts.oob ? ` hx-swap-oob="true"` : ""} class="max-h-[45%] shrink-0 overflow-y-auto bg-bg-content"
  hx-get="${url}" hx-trigger="every 5s, refresh" hx-swap="outerHTML"
  hx-on--load="window.processes.watch(this)">${cards}</div>`;
}

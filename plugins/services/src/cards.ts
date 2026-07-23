// The cards themselves — the contents of `#service-list`, in the order that
// matters: what is running, then what crashed (the thing you opened this tab
// for), then the rest, alphabetically inside each group.
//
// This is what the list refetches, so the container element is never replaced:
// its scroll position and its polling timer survive every refresh.
const RANK: Record<string, number> = { running: 0, starting: 1, restarting: 1, crashed: 2, idle: 3 };

export default function (ctx: Context, _session: Session | null, opts: { selected?: string }): string {
    const services = Object.values(ctx.state.services ?? {})
        .sort((a, b) => (RANK[a.state]! - RANK[b.state]!) || a.name.localeCompare(b.name));

    if (!services.length) {
        return `<div class="px-3 py-6 text-center text-ui text-text-placeholder">No services — add one to <code>workspace.json</code>.</div>`;
    }
    return services.map(service => ctx.fns.processes.card({ service, selected: service.name === opts.selected })).join("");
}

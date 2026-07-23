// The plugin tab strip: an icon per tab, and a label only on the one you are
// on. Eight plugins with eight words do not fit a half-window pane, and a strip
// that scrolls is a strip you cannot read at a glance — so the label goes where
// it is actually needed, on the tab that says where you are, and the rest carry
// their name in a tooltip.
//
// Rendered inside the layout, and again out of band after an htmx partial swap
// so the active tab follows the URL.
//
// The tabs are plain links: hx-boost on the pane turns them into partial swaps,
// so wmlet's tab client (click handlers, pinning) has nothing left to do here.
export default function (ctx: Context, _session: Session | null, opts: { path?: string; oob?: boolean }): string {
    // A plugin gets a tab when it answers GET /<namespace> — a library or a bare
    // skill has nothing to show. Preview leads: it is what the workspace is for.
    const plugins = (ctx.state.plugins ?? []).filter(p => p.tab)
        .sort((a, b) => Number(b.namespace === "preview") - Number(a.namespace === "preview"));
    const path = opts.path ?? "/";
    const tab = (p: (typeof plugins)[number]) => {
        const active = path === `/${p.namespace}` || path.startsWith(`/${p.namespace}/`);
        return `<a ${ctx.fns.ui.attr({ entity: "tab", id: p.namespace, status: active ? "active" : "" })} class="ui-tab${active ? " is-active" : ""}" role="tab" aria-selected="${active}" href="/${esc(p.namespace)}"
      hx-get="/${esc(p.namespace)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true"
    ><i class="ph ${esc(p.icon)} ui-tab__icon" aria-hidden="true"></i><span class="ui-tab__label">${esc(p.label)}</span></a>`;
    };
    return `<nav id="tabs"${opts.oob ? ` hx-swap-oob="true"` : ""} class="h-12 shrink-0 flex items-center justify-between gap-4 px-3 bg-bg-tertiary border-b border-border-separator">
  <div class="ui-tabbar" role="tablist">${plugins.map(tab).join("")}</div>
  <a ${ctx.fns.ui.attr({ action: "plugins" })} class="ui-tabbar__add${path.startsWith("/plugins") ? " is-active" : ""}" href="/plugins" title="Plugins" aria-label="Plugins"
    hx-get="/plugins" hx-target="#main" hx-swap="innerHTML" hx-push-url="true"><i class="ph ph-puzzle-piece" aria-hidden="true"></i></a>
</nav>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

// The plugin tab strip. Rendered inside the layout, and again out of band after
// an htmx partial swap so the active tab follows the URL.
export default function (ctx: Context, _session: Session | null, opts: { path?: string; oob?: boolean }): string {
    // Preview leads: it is what the workspace is for — the app being built.
    const mounted: string[] = ctx.state.plugins ?? [];
    const plugins = [...mounted].sort((a, b) => Number(b === "preview") - Number(a === "preview"));
    const path = opts.path ?? "/";
    const tab = (p: string) => {
        const active = path === `/${p}` || path.startsWith(`/${p}/`);
        const style = active ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900";
        return `<a class="h-full flex items-center border-b-2 ${style}" href="/${esc(p)}"
      hx-get="/${esc(p)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">${esc(p)}</a>`;
    };
    return `<nav id="tabs"${opts.oob ? ` hx-swap-oob="true"` : ""} class="h-12 shrink-0 border-b border-gray-200 flex items-center gap-4 px-4">
${plugins.map(tab).join("")}
  <a class="text-gray-400 hover:text-gray-900 ml-auto" href="/fns">functions</a>
</nav>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

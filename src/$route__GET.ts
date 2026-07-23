// GET / — home: what this workspace has mounted.
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    const plugins = ctx.state.plugins ?? [];
    return {
        title: "home",
        main: `<h1 class="text-lg font-semibold mb-1">procs</h1>
<div class="text-xs text-text-tertiary font-mono mb-4">workdir: ${esc(ctx.fns.project.workdir({}))}</div>
<h2 class="font-semibold mb-2">plugins</h2>
<ul class="space-y-1">${plugins.map(p => `<li class="inline-flex items-center gap-2"><i class="ph ${esc(p.icon)} text-text-tertiary" aria-hidden="true"></i>${p.tab ? `<a class="text-text-link hover:underline" href="/${esc(p.namespace)}">${esc(p.label)}</a>` : esc(p.label)}<span class="text-2xs text-text-tertiary">${esc(p.description)}</span></li>`).join("")}</ul>`,
    };
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

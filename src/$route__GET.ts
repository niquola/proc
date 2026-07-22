// GET / — home: what this workspace has mounted.
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    const plugins: string[] = ctx.state.plugins ?? [];
    return {
        title: "home",
        main: `<h1 class="text-lg font-semibold mb-1">procs</h1>
<div class="text-xs text-gray-500 font-mono mb-4">workdir: ${esc(ctx.fns.project.workdir({}))}</div>
<h2 class="font-semibold mb-2">plugins</h2>
<ul class="space-y-1">${plugins.map(p => `<li><a class="text-blue-700 hover:underline" href="/${esc(p)}">${esc(p)}</a></li>`).join("")}</ul>`,
    };
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

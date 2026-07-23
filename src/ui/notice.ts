// What went wrong, or what just worked. One shape for both so a page does not
// invent its own each time, and `role` makes the text readable by the workspace
// — an agent that pressed a button can find out whether it worked.
export default function (ctx: Context, _session: Session | null, opts: { text: string; tone?: "danger" | "success" | "warning" | "info" }): string {
    const tone = opts.tone ?? "info";
    return `<div class="rounded-md border border-state-${tone}-border bg-state-${tone}-bg px-4 py-2 text-ui text-state-${tone}-fg" ${ctx.fns.ui.attr({ role: tone === "danger" ? "error" : "notice" })}>${esc(opts.text)}</div>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

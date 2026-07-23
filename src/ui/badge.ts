// A small fact about the thing next to it — a state, a count, a face a plugin
// wears. Tones come from the same state palette as ui.notice.
export default function (ctx: Context, _session: Session | null, opts: { text: string; tone?: "neutral" | "info" | "success" | "warning" | "danger"; role?: string }): string {
    const tone = opts.tone ?? "neutral";
    return `<span class="rounded-sm border border-state-${tone}-border bg-state-${tone}-bg px-1.5 py-0.5 text-3xs text-state-${tone}-fg" ${ctx.fns.ui.attr({ role: opts.role })}>${esc(opts.text)}</span>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

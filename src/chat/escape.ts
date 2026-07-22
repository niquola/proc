// HTML-escape one string. The single copy for the whole chat UI — every other
// src/chat/*.ts file interpolates through ctx.fns.chat.escape({text}).
export default function (_ctx: Context, _session: Session | null, opts: { text?: unknown }): string {
    return String(opts.text ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

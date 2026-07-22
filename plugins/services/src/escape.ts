// HTML-escape one string. The plugin's own copy — a tab that renders another
// process's output should not reach into the chat's helpers for it.
export default function (_ctx: Context, _session: Session | null, opts: { text?: unknown }): string {
    return String(opts.text ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

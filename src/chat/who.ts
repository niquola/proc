// Who else is in this workspace, drawn in the bar above the chat. Initials
// rather than names: the bar is 48px and the point is a glance — how many
// people are looking at this conversation, and whether one of them is you.
//
// Alone (or with AUTH off, where everyone is the same anonymous person) it
// renders nothing at all: a badge saying "1" would be noise.
export default function (ctx: Context, session: Session | null, opts?: { oob?: boolean }): string {
    const here = ctx.fns.events.presence({});
    const me = (session as any)?.user?.sub;
    const chips = here.length < 2 ? "" : here.map(p => `<span
    class="inline-flex size-6 items-center justify-center rounded-full text-3xs font-medium ${p.id === me ? "bg-brand text-text-inverse" : "bg-bg-quaternary text-text-muted"}"
    title="${esc(p.name)}${p.tabs > 1 ? ` · ${p.tabs} tabs` : ""}" ${ctx.fns.ui.attr({ entity: "person", id: p.id })}>${esc(initials(p.name))}</span>`).join("");

    return `<div id="chat-who"${opts?.oob ? ` hx-swap-oob="true"` : ""} class="flex items-center gap-1">${chips}</div>`;
}

function initials(name: string): string {
    const parts = name.trim().split(/[\s_.-]+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase();
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

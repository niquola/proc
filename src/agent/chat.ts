// The transcript as HTML — user messages, agent text, collapsed thinking and
// tool calls, in the wmlet shape: cards in a scrolling column.
export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    const agent = ctx.state.agent ?? { status: "offline", messages: [] };
    const body = agent.messages.map(render).join("");
    return `<div id="chat" class="flex-1 overflow-y-auto p-4 space-y-3">
${body || `<div class="text-gray-400">${esc(agent.error ?? "no messages yet")}</div>`}
${agent.status === "running" ? `<div class="text-xs text-gray-400">working…</div>` : ""}
</div>`;
}

function render(m: types.agent.Message): string {
    if (m.role === "user") {
        return `<div class="rounded border border-gray-200 bg-gray-50 p-3 ml-8 whitespace-pre-wrap">${esc(m.text)}</div>`;
    }
    if (m.kind === "thought") {
        return `<details class="rounded border border-gray-200 p-3 text-gray-500">
<summary class="cursor-pointer text-xs uppercase tracking-wide">thinking</summary>
<div class="mt-2 whitespace-pre-wrap text-xs">${esc(m.text)}</div></details>`;
    }
    if (m.kind === "tool") {
        return `<details class="rounded border border-gray-200 p-3">
<summary class="cursor-pointer flex items-center gap-2"><span class="text-xs uppercase tracking-wide text-gray-400">tool</span>
<span class="font-medium">${esc(m.title ?? "")}</span>${m.status ? `<span class="text-xs text-gray-400">${esc(m.status)}</span>` : ""}</summary>
<pre class="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">${esc(m.text)}</pre></details>`;
    }
    return `<div class="rounded border border-gray-200 p-3 whitespace-pre-wrap">${esc(m.text)}</div>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

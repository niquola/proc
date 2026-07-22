// A run of consecutive `kind:"tool"` messages, collapsed into one pill: a chip
// per distinct tool kind, "N actions", and a panel that opens with the rows.
//
// The panel is a native `popover` toggled by `popovertarget` — no JS. wmlet
// lazy-fills it from a <template> on beforetoggle; here the rows are always in
// the DOM, since the whole transcript is re-rendered on every agent event
// anyway.
//
// It is positioned by CSS anchor positioning, as wmlet does. An open popover
// lives in the top layer, where the containing block of an absolutely
// positioned box is the viewport, not the `relative` pill — so `absolute` pins
// the panel to the page corner instead of the trigger. The pill names itself
// with `anchor-name`, the panel points at it with `position-anchor`, and
// `.tool-actions-tooltip` in $layout.ts does the rest. The panel is wider than
// the 384px column on purpose, which is also why it has to be a popover: the
// transcript scroller would otherwise clip it.
export default function (ctx: Context, _session: Session | null, opts: { messages: types.agent.Message[] }): string {
    const messages = opts.messages ?? [];
    if (messages.length === 0) return "";

    const count = messages.length;
    const label = `${count} ${count === 1 ? "action" : "actions"}`;
    const failed = messages.filter(m => state(m) === "failed").length;
    const running = messages.filter(m => state(m) === "running").length;
    const incomplete = messages.filter(m => state(m) === "incomplete").length;
    const description = [
        label,
        failed > 0 ? `${failed} failed` : "",
        running > 0 ? `${running} running` : "",
        incomplete > 0 ? `${incomplete} incomplete` : "",
    ].filter(Boolean).join(", ");

    const id = `tools-${String(messages[0]!.id).replace(/[^\w-]/g, "_")}`;
    const panelId = `${id}-details`;
    const large = count > 10;
    const chips = kinds(ctx, messages).map(chip).join("");
    const rows = messages.map(message => ctx.fns.chat.toolRow({ message, name: panelId, open: count === 1 })).join("");

    return `<div id="${id}" class="tool-actions relative inline-block max-w-full" data-assistant-block="tools">
  <button type="button"
    class="tool-actions-anchor inline-flex min-h-8 items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-text-muted hover:text-text-primary cursor-pointer"
    aria-label="${ctx.fns.chat.escape({ text: description })}" popovertarget="${panelId}" style="anchor-name:--${id}">
    <span class="inline-flex shrink-0 items-center gap-1" aria-hidden="true">${chips}</span>
    <span class="min-w-0 truncate text-ui tool-name">${label}</span>
  </button>
  <div id="${panelId}" popover="auto"
    class="tool-actions-tooltip${large ? " tool-actions-tooltip-large" : ""} ui-overlay-shadow overflow-hidden rounded-xl border border-border-input bg-bg-content text-text-primary"
    style="position-anchor:--${id}">
    <div class="tool-actions-scroll overflow-y-auto p-2">${rows}</div>
  </div>
</div>`;
}

// One chip per distinct icon, in first-seen order; a chip pulses while any tool
// behind it is still running.
function kinds(ctx: Context, messages: types.agent.Message[]): { icon: string; running: boolean }[] {
    const unique: { icon: string; running: boolean }[] = [];
    for (const message of messages) {
        const icon = ctx.fns.chat.toolMeta({ message }).icon;
        const existing = unique.find(item => item.icon === icon);
        if (existing) existing.running ||= state(message) === "running";
        else unique.push({ icon, running: state(message) === "running" });
    }
    return unique;
}

function chip(meta: { icon: string; running: boolean }): string {
    return `<span class="tool-icon inline-flex size-5 items-center justify-center rounded-full border border-border-subtle bg-bg-content text-text-muted${meta.running ? " tool-icon-running" : ""}"${meta.running ? ` data-running="true"` : ""}>
      <i class="ph text-[12px] ${meta.icon}" aria-hidden="true"></i>
    </span>`;
}

function state(message: types.agent.Message): "failed" | "running" | "incomplete" | undefined {
    if (message.data?.incomplete) return "incomplete";
    if (message.status === "failed") return "failed";
    const status = message.status;
    if (status === "in_progress" || status === "running" || status === "pending") return "running";
    return undefined;
}

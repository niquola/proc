// The model / reasoning dropdown: the panel half of the composer's model menu.
// The trigger lives in `controls.ts`, which wraps both in the `data-menu`
// element `window.chat.menu` wires — trigger first, this panel last, toggled by
// the `hidden` class. wmlet anchored it with CSS anchor positioning; the column
// is a fixed 384px and the panel is 256px, so plain `absolute` in the relative
// wrapper is enough.
//
// Both sections are fed by `ctx.fns.agent.options({})`, which flattens the
// agent's grouped `SessionConfigOption[]` into `{ configId, current, items }`.
// An agent that advertises neither still renders both headings — "Not
// advertised" is the honest answer, and it keeps the menu's shape stable.
//
// Picking an option is one `hx-post` to /agent/config with the whole choice in
// `hx-vals`; the response carries the transcript plus the out-of-band islands,
// so the swap that closes the menu also refreshes the label.
export default function (ctx: Context, _session: Session | null, _opts: {} = {}): string {
    const options: any = ctx.fns.agent.options({});

    const section = (kind: "model" | "effort", option: any): string => {
        const items: any[] = option?.items ?? [];
        if (!option || items.length === 0) {
            return `<div class="px-3 py-1.5 text-sm text-text-placeholder">Not advertised</div>`;
        }
        return items.map(item => {
            const value = String(item.value ?? "");
            const name = ctx.fns.chat.escape({ text: String(item.name || value) });
            const title = ctx.fns.chat.escape({ text: String(item.description || value) });
            const id = ctx.fns.chat.escape({ text: value });
            const vals = ctx.fns.chat.escape({ text: JSON.stringify({ configId: option.configId, value }) });
            // options.ts marks the selected item; `current` is a display label
            // ("5.4 Mini") and never equals the id ("gpt-5.4-mini").
            const selected = item.selected === true;
            const check = selected ? `<i class="ph ph-check text-2xs" aria-hidden="true"></i>` : "";
            return `<button type="button" class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left hover:bg-bg-quaternary"
        data-action="${kind}" data-entity="${kind}" data-id="${id}" title="${title}"
        hx-post="/agent/config" hx-vals="${vals}" hx-target="#chat" hx-swap="outerHTML">
        <span class="flex-1">${name}</span>
        <span class="w-4 text-center">${check}</span>
      </button>`;
        }).join("\n");
    };

    return `<div id="model-menu" class="ui-overlay-shadow hidden absolute bottom-full left-0 mb-1 z-50 max-h-80 w-64 overflow-y-auto rounded-md border border-border-input bg-bg-content py-1 text-text-primary">
    <div class="px-3 py-1 text-sm text-text-placeholder">Intelligence</div>
    <div>
${section("effort", options?.effort)}
    </div>
    <div class="my-1 border-t border-border-subtle"></div>
    <div class="px-3 py-1 text-sm text-text-placeholder">Model</div>
    <div>
${section("model", options?.model)}
    </div>
  </div>`;
}

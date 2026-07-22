// The left half of the composer's control row — wmlet's `TopicComposer` bottom
// bar minus the send button: the plus menu holding the plan-mode toggle, a
// spacer, the context ring, and the model button that opens the model / effort
// menu.
//
// `#chat-controls` is an island: `#composer` is never swapped, so every response
// that can change a mode, a model or the context window sends this back with
// `hx-swap-oob="true"`.
//
// Both menus are a `data-menu` pair — trigger first, panel last —
// `window.chat.menu` toggles the panel, closes its sibling and closes on an
// outside click. They open upward with plain `absolute` positioning: the column
// is 384px wide and the row sits at its bottom edge, so wmlet's `fixed` panels
// (which it placed from JS) have nowhere better to go.
//
// The plan toggle is a bodiless `POST /agent/mode`, which flips the session mode
// server-side; `hx-params="none"` keeps the composer's text out of that request.
export default function (ctx: Context, _session: Session | null, opts: { oob?: boolean } = {}): string {
    const planning = (ctx.state.agent?.currentModeId ?? "default") === "plan";
    const model = ctx.fns.chat.escape({ text: ctx.fns.agent.options({}).model.current });
    return `<div id="chat-controls"${opts.oob ? ` hx-swap-oob="true"` : ""} class="flex flex-1 items-center gap-3 min-w-0">
      <div data-menu class="relative shrink-0" hx-on--load="if (event.target === this) window.chat.menu(this)">
        <button type="button" class="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg-tertiary text-text-muted transition-colors hover:bg-bg-tint-hover hover:text-text-primary" title="Add">
          <i class="ph ph-plus text-base" aria-hidden="true"></i>
        </button>
        <div class="ui-overlay-shadow hidden absolute bottom-full left-0 mb-2 z-50 w-48 rounded-md border border-border-input bg-bg-content py-1 text-sm text-text-primary">
          <button type="button" data-action="plan" class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-bg-quaternary"
            hx-post="/agent/mode" hx-params="none" hx-target="#chat" hx-swap="outerHTML">
            <i class="ph ph-list-checks w-4 text-text-tertiary" aria-hidden="true"></i>
            <span class="flex-1">Plan mode</span>
            <span class="h-5 w-9 rounded-full p-0.5 transition-colors ${planning ? "bg-text-tertiary" : "bg-border-input"}">
              <span class="block h-4 w-4 rounded-full bg-bg-content transition-transform${planning ? " translate-x-4" : ""}"></span>
            </span>
          </button>
        </div>
      </div>

      <span class="flex-1"></span>
${ctx.fns.chat.usage({})}
      <div data-menu class="relative flex items-center min-w-0" hx-on--load="if (event.target === this) window.chat.menu(this)">
        <button type="button" class="inline-flex h-9 min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-md border border-border-separator bg-bg-content px-3 text-ui font-normal text-text-primary transition-colors hover:bg-bg-tertiary" title="Model and reasoning">
          <span class="inline-flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden">
            <span class="truncate">${model}</span>
          </span>
          <i class="ph ph-caret-down text-xs text-text-muted shrink-0" aria-hidden="true"></i>
        </button>
${ctx.fns.chat.models({})}
      </div>
    </div>`;
}

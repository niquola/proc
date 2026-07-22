// The context ring in the composer's control row: a 16px conic-gradient disc
// filled clockwise to the share of the context window the session has spent,
// with a hover card giving the numbers behind it.
//
// The ring is pure CSS — a `conic-gradient` background on the outer div, an
// opaque circle punched over it — so there is no client JS and nothing to
// re-wire after a swap.
//
// Two deviations from wmlet. The cost lines are gone: this workspace's
// `usage_update` carries only `used`/`size`, there is no price anywhere in
// `ctx.state.agent`, so per-turn input/output/cache and both currency rows are
// dropped and "Project total" holds agent time alone. And the tooltip is
// `absolute bottom-full right-0` instead of wmlet's `fixed` — wmlet positioned
// its fixed overlays from JS, and the ring sits at the bottom edge of a 384px
// column, so a card that opens upward from the ring's right edge is the version
// that stays on screen without a script.
export default function (ctx: Context, _session: Session | null, _opts: {} = {}): string {
    const used = finite(ctx.state.agent?.usage?.used);
    const size = finite(ctx.state.agent?.usage?.size);
    const percent = size > 0 ? Math.max(0, Math.min(100, (used / size) * 100)) : 0;
    const agentMs = finite(ctx.state.agent?.totals?.agentMs);
    const agentLabel = agentMs > 0 ? formatAgentMs(agentMs) : "";
    return `<div id="usage-ring" class="group relative h-4 w-4 rounded-full p-0.5" role="img"
      aria-label="${size > 0 ? `Context usage ${Math.round(percent)}% full` : "Context usage"}"
      style="background: conic-gradient(var(--color-text-tertiary, #78716c) ${percent * 3.6}deg, var(--color-border-input) 0deg)">
      <div class="h-full w-full rounded-full bg-bg-tertiary"></div>
      <div id="usage-tooltip" class="ui-overlay-shadow pointer-events-none absolute bottom-full right-0 mb-2 z-50 hidden w-56 rounded-md border border-border-input bg-bg-content px-3 py-2 text-xs text-text-primary group-hover:block">
        <div class="flex items-center justify-between gap-4">
          <span class="text-text-placeholder">Context</span>
          <span id="usage-tooltip-percent" class="tabular-nums">${Math.round(percent)}%</span>
        </div>
        <div class="mt-1 flex items-center justify-between gap-4">
          <span class="text-text-placeholder">Tokens</span>
          <span id="usage-tooltip-tokens" class="tabular-nums">${used.toLocaleString()} / ${size.toLocaleString()}</span>
        </div>
${agentLabel ? `        <div class="mt-2 border-t border-border-subtle pt-2 space-y-1">
          <div class="text-text-placeholder">Project total</div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-text-placeholder">Agent time</span>
            <span class="tabular-nums">${agentLabel}</span>
          </div>
        </div>
` : ""}        <div id="usage-tooltip-note" class="mt-2 border-t border-border-subtle pt-2 text-text-placeholder">${size > 0 ? "The agent may compact context as needed." : "Waiting for usage"}</div>
      </div>
    </div>`;
}

function finite(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatAgentMs(ms: number): string {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds - minutes * 60;
    if (minutes < 60) return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes - hours * 60;
    return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

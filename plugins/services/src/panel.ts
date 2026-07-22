// The whole tab: a bar that says how much of the workspace is up, the cards, and
// the log pane of the selected service filling everything below them.
//
// It breaks out of `#main`'s padding (`-m-6`) and takes the pane's full height,
// the same trick the preview and aidbox tabs use, so the log scroller ends at the
// bottom of the window instead of pushing the page.
//
// `track` runs first: editing workspace.json shows up on the next paint, with no
// restart and nothing else to press.
export default async function (ctx: Context, _session: Session | null, opts: { selected?: string }): Promise<string> {
    await ctx.fns.services.track({});
    const services = Object.values(ctx.state.services ?? {});
    const running = services.filter(service => service.state === "running").length;

    return `<div class="-m-6 flex h-[calc(100vh-3rem)] flex-col bg-bg-content">
  <div class="ui-panel-bar">
    <span class="text-ui font-medium text-text-heading">services</span>
    <span class="text-2xs tabular-nums text-text-tertiary">${running} running / ${services.length}</span>
  </div>
${ctx.fns.processes.list({ selected: opts.selected })}
${ctx.fns.processes.logs({ name: opts.selected })}
</div>`;
}

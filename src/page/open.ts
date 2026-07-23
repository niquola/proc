// Open something in the right pane. Either a URL — the plugin pages carry their
// whole state in one (`/questionnaire?q=tobacco`), which is the shortest way to
// put the user in front of something — or an entity, whose own link is followed.
//
// Navigation stays partial: htmx swaps the pane and pushes the URL, so the chat,
// the event stream and this bridge stay alive. A full reload drops all three.
export default async function (ctx: Context, _session: Session | null, opts: { url?: string } & types.page.Descriptor & { show?: boolean; settleMs?: number }) {
    const verb = opts.url ? "go" : "open";
    const result = await ctx.fns.page.eval({ code: `return await window.page.${verb}(${JSON.stringify(opts)})` });
    await Bun.sleep(opts.settleMs ?? 600);
    return result;
}

// Switch the right pane to a plugin's tab — the same thing clicking it does.
export default async function (ctx: Context, _session: Session | null, opts: { plugin: string }) {
    const tabs = (ctx.state.plugins ?? []).map(p => p.namespace);
    if (!tabs.includes(opts.plugin)) throw new Error(`no such plugin tab: ${opts.plugin} (have ${tabs.join(", ")})`);
    await ctx.fns.page.open({ url: `/${opts.plugin}` });
    return { tab: opts.plugin };
}

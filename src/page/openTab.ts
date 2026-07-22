// Switch the right pane to a plugin's tab — the same thing clicking it does.
export default async function (ctx: Context, _session: Session | null, opts: { plugin: string }) {
    const plugins: string[] = ctx.state.plugins ?? [];
    if (!plugins.includes(opts.plugin)) throw new Error(`no such plugin tab: ${opts.plugin} (have ${plugins.join(", ")})`);
    await ctx.fns.page.open({ url: `/${opts.plugin}` });
    return { tab: opts.plugin };
}

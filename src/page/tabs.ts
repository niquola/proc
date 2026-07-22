// Which plugin tabs exist and which one the open page is showing.
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const plugins: string[] = ctx.state.plugins ?? [];
    const path = await ctx.fns.page.eval({ code: "return location.pathname" }).catch(() => null);
    return { tabs: plugins, current: plugins.find(p => path === `/${p}` || String(path).startsWith(`/${p}/`)) ?? null };
}

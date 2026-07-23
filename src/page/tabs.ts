// Which plugin tabs exist and which one the open page is showing.
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const tabs = (ctx.state.plugins ?? []).map(p => p.namespace);
    const path = await ctx.fns.page.eval({ code: "return location.pathname" }).catch(() => null);
    return { tabs, current: tabs.find(t => path === `/${t}` || String(path).startsWith(`/${t}/`)) ?? null };
}

// List mounted plugins (every root that carries a namespace) with how many
// fns / routes each contributes.
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const roots = await ctx.fns.project.roots({});
    const entries = await ctx.fns.project.scan({});
    return roots
        .filter((r: any) => r.namespace)
        .map((r: any) => {
            const mine = entries.filter((e: any) => e.namespace === r.namespace);
            return {
                namespace: r.namespace,
                dir: r.dir,
                fns: mine.filter((e: any) => e.kind === "fn").length,
                routes: mine.filter((e: any) => e.kind === "route" || e.kind === "script").length,
                types: mine.filter((e: any) => e.kind === "type").length,
            };
        });
}

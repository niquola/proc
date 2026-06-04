
// Sync one file from disk into the live process, whatever it is.
// Companion to an external editor/Write: write file -> dev.sync(rel) -> test.
export default async function (ctx: Context, opts: { rel: string }) {
    const entry = ctx.fns.project.classify(opts.rel);
    if (entry.kind === 'fn') {
        const name = entry.moduleDir === '.' ? entry.runtimeName : entry.moduleDir.replaceAll('/', '.') + '.' + entry.runtimeName;
        await ctx.fns.repl.load(ctx, { name });
        await ctx.genTypes(ctx);
        return { synced: opts.rel, as: 'ctx.fns.' + name };
    }
    if (entry.kind === 'route' || entry.kind === 'script') {
        await ctx.fns.http.loadRoutes(ctx);
        return { synced: opts.rel, as: (entry as any).method ? (entry as any).method + ' ' + (entry as any).routePath : (entry as any).routePath };
    }
    if (entry.kind === 'type') {
        await ctx.genTypes(ctx);
        return { synced: opts.rel, as: 'type' };
    }
    throw new Error('nothing to sync: ' + opts.rel + ' (' + entry.kind + ': ' + (entry as any).reason + ')');
}

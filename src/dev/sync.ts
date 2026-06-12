// Sync one file from disk into the live process, whatever it is.
// Companion to an external editor/Write: write file → dev.sync({rel}) → test.
export default async function (ctx: Context, _session: Session | null, opts: { rel: string }) {
    const entry = ctx.fns.project.classify({ rel: opts.rel });

    // Namespace lint gate (fn/type files affect the registry/types tree).
    if (entry.kind === 'fn' || entry.kind === 'type') {
        const lint = await ctx.fns.dev.lint({ silent: true });
        if (!lint.ok) throw new Error(`src/${opts.rel} rejected by lint:\n` + lint.errors.map((e: string) => '  ✗ ' + e).join('\n'));
    }

    if (entry.kind === 'fn') {
        const name = entry.moduleDir === '.' ? entry.runtimeName : entry.moduleDir.replaceAll('/', '.') + '.' + entry.runtimeName;
        await ctx.fns.repl.load({ name });
        await ctx.genTypes({});
        return { synced: opts.rel, as: 'ctx.fns.' + name };
    }
    if (entry.kind === 'route' || entry.kind === 'script') {
        await ctx.fns.http.loadRoutes({});
        const as = entry.kind === 'route' ? `${entry.method} ${entry.routePath}` : `GET ${entry.routePath}`;
        return { synced: opts.rel, as };
    }
    if (entry.kind === 'type') {
        await ctx.genTypes({});
        return { synced: opts.rel, as: 'type' };
    }
    throw new Error(`nothing to sync: ${opts.rel} (${entry.kind}: ${(entry as any).reason})`);
}

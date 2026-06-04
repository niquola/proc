// Define a function/route synchronously: write file + load + genTypes in one
// call. Errors are immediate (not a watcher race): broken code → this throws,
// nothing half-registered. The agent's primary way to add code:
//   await ctx.fns.dev.def(ctx, { name: "math.fib", code: "export default ..." })
//   await ctx.fns.dev.def(ctx, { rel: "math/$route__GET.ts", code: "..." })
export default async function (ctx: Context, opts: { name?: string; rel?: string; code: string }) {
    const roots = await ctx.fns.project.roots(ctx);
    let rel = opts.rel;
    if (!rel && opts.name) {
        const segs = opts.name.split('.');
        const fnName = segs.pop()!;
        if (segs.length === 0) throw new Error(`name must be "module.fn", got: ${opts.name}`);
        rel = segs.join('/') + '/' + fnName + '.ts';
    }
    if (!rel) throw new Error('need opts.name ("module.fn") or opts.rel ("module/file.ts")');

    const entry = ctx.fns.project.classify(rel);
    if (entry.kind === 'skip') throw new Error(`${rel} would be skipped by scanner: ${entry.reason}`);

    // Validate before touching disk: parse error → throw, no file written.
    new Bun.Transpiler({ loader: 'ts' }).transformSync(opts.code);

    const abs = roots[0]!.dir + '/' + rel;
    const existed = await Bun.file(abs).exists();
    await Bun.write(abs, opts.code);

    try {
        if (entry.kind === 'fn') {
            await ctx.fns.repl.load(ctx, { name: entry.moduleDir.replaceAll('/', '.') + '.' + entry.runtimeName });
        } else if (entry.kind === 'route' || entry.kind === 'script') {
            await ctx.fns.http.loadRoutes(ctx);
        }
        await ctx.genTypes(ctx);
    } catch (e: any) {
        throw new Error(`src/${rel} written but failed to load: ${e?.message ?? e}`);
    }

    const as = entry.kind === 'fn' ? `ctx.fns.${entry.moduleDir.replaceAll('/', '.')}.${entry.runtimeName}`
        : entry.kind === 'route' ? `${entry.method} ${entry.routePath}`
        : entry.kind === 'script' ? `GET ${entry.routePath}` : rel;
    console.log(`[def] ${existed ? 'redefined' : 'defined'} ${as}  ←  src/${rel}`);
    return { [existed ? 'redefined' : 'defined']: as, file: `src/${rel}`, kind: entry.kind };
}

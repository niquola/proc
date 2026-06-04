// Hot-reload functions from disk into the running process.
//   ctx.fns.repl.load(ctx, { name: "project.scan" })  → reload one fn
//   ctx.fns.repl.load(ctx, { name: "project" })       → reload whole module
export default async function (ctx: Context, opts: { name: string }) {
    const target = opts.name;
    if (target.includes('.')) {
        const segs = target.split('.');
        const fnName = segs.pop()!;
        const modPath = segs.join('/');
        await loadFile(ctx, modPath, fnName);
        return { reloaded: target };
    }

    const entries = await ctx.fns.project.scan(ctx);
    const loaded: string[] = [];
    for (const entry of entries) {
        if (entry.kind !== 'fn') continue;
        if (entry.moduleDir !== target) continue;
        await loadFile(ctx, target, entry.runtimeName);
        if (!loaded.includes(entry.runtimeName)) loaded.push(entry.runtimeName);
    }
    return { reloaded: target, count: loaded.length, fns: loaded };
}

async function loadFile(ctx: Context, modPath: string, fnName: string) {
    const candidates = [modPath + '/' + fnName + '.ts', modPath + '/$' + fnName + '.ts'];
    for (const root of await ctx.fns.project.roots(ctx)) {
        for (const rel of candidates) {
            const abs = root.dir + '/' + rel;
            if (!(await Bun.file(abs).exists())) continue;
            const m = await import(abs + `?t=${Date.now()}`);
            const fn = m.default;
            if (typeof fn !== 'function') throw new Error(`${rel}: no default function export`);
            const segs = modPath.split('/');
            let tgt: any = ctx.fns;
            for (const seg of segs) {
                tgt[seg] = tgt[seg] || {};
                tgt = tgt[seg];
            }
            tgt[fnName] = fn;
            console.log(`[reload] ctx.fns.${segs.join('.')}.${fnName}  ←  ${root.name}/${rel}`);
            return;
        }
    }
    throw new Error(`no file for ${modPath}/${fnName}`);
}

// Hot-reload functions from disk into the running process.
//   ctx.fns.repl.load({ name: "project.scan" })  → reload one fn
//   ctx.fns.repl.load({ name: "project" })       → reload whole module
//   ctx.fns.repl.load({ name: "genTypes" })      → reload a root $name.ts fn
import { defineRootFn } from "../loadFns";

export default async function (ctx: Context, _session: Session | null, opts: { name: string }) {
    const target = opts.name;

    // Root fn ($name.ts at src root → ctx.<name>). Without this a single-segment
    // name fell through to the module-reload loop and silently did nothing.
    const entries = await ctx.fns.project.scan({});
    if (!target.includes('.')) {
        const root = entries.find((e: any) => e.kind === 'fn' && e.moduleDir === '.' && e.runtimeName === target);
        if (root) {
            const m = await import((root as any).abs + `?t=${Date.now()}`);
            if (typeof m.default !== 'function') throw new Error(`${target}: no default function export`);
            defineRootFn(ctx, target, m.default);
            console.log(`[reload] ctx.${target}  ←  ${(root as any).root}/${(root as any).rel}`);
            return { reloaded: target, root: true };
        }
    }

    if (target.includes('.')) {
        const segs = target.split('.');
        const fnName = segs.pop()!;
        const modPath = segs.join('/');
        await loadFile(ctx, modPath, fnName);
        return { reloaded: target };
    }

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
    for (const root of await ctx.fns.project.roots({})) {
        for (const rel of candidates) {
            const abs = root.dir + '/' + rel;
            if (!(await Bun.file(abs).exists())) continue;
            const m = await import(abs + `?t=${Date.now()}`);
            const fn = m.default;
            if (typeof fn !== 'function') throw new Error(`${rel}: no default function export`);
            // Raw fns live in ctx.state.registry (ctx.fns is the injecting Proxy).
            const segs = modPath.split('/');
            let tgt: any = (ctx.state as any).registry;
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

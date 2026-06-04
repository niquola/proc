// File watcher: save a file → it's live. The fastest possible dev loop —
// reload stops being a step at all. classify() decides what to do per file:
//   fn     → hot-load into ctx.fns (+ genTypes)
//   route  → http.loadRoutes
//   type   → genTypes
// Errors (syntax etc.) are logged, old version keeps running.
import { watch } from "node:fs";

export default async function (ctx: Context) {
    const st = ctx.state as any;
    if (st.watcher) return { watching: 'already' };

    const roots = await ctx.fns.project.roots(ctx);
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = async () => {
        timer = null;
        const batch = [...pending];
        pending.clear();
        let needTypes = false, needRoutes = false, needReload = false;

        // macOS FSEvents can collapse "new dir + files inside" into one event
        // on the dir — expand directory events into their contained files.
        const files: string[] = [];
        for (const rel of batch) {
            const abs = roots[0]!.dir + '/' + rel;
            const stat = await Bun.file(abs).stat().catch(() => null);
            if (stat?.isDirectory()) {
                const glob = new Bun.Glob('**/*');
                for await (const sub of glob.scan(abs)) files.push(rel + '/' + sub);
            } else {
                files.push(rel);
            }
        }

        // Per-file error board: broken file → entry here; fixed → removed.
        // repl/$route__POST.ts attaches this to every REPL response, so whoever
        // writes files (agent, editor) sees load failures on the next call.
        const errors: Map<string, string> = ((ctx.state as any).dev ??= { errors: new Map() }).errors;

        for (const rel of files) {
            const entry = ctx.fns.project.classify(rel);
            if (entry.kind === 'skip') continue;
            const exists = await Bun.file(roots[0]!.dir + '/' + rel).exists();
            if (!exists) { errors.delete(rel); needTypes = true; continue; } // deleted: types only, fn stays in memory
            try {
                if (entry.kind === 'fn') {
                    if (entry.moduleDir === '.') {
                        const m = await import(roots[0]!.dir + '/' + rel + `?t=${Date.now()}`);
                        if (typeof m.default === 'function') {
                            (ctx as any)[entry.runtimeName] = m.default;
                            console.log(`[watch] ctx.${entry.runtimeName}  ←  ${rel}`);
                        }
                    } else {
                        await ctx.fns.repl.load(ctx, { name: entry.moduleDir.replaceAll('/', '.') + '.' + entry.runtimeName });
                    }
                    needTypes = true;
                    needReload = true;
                } else if (entry.kind === 'route' || entry.kind === 'script') {
                    needRoutes = true;
                    needReload = true;
                } else if (entry.kind === 'type') {
                    needTypes = true;
                }
                errors.delete(rel);
            } catch (e: any) {
                errors.set(rel, String(e?.message ?? e));
                console.error(`[watch] ${rel}: ${e?.message ?? e}`);
            }
        }

        try {
            if (needRoutes) await ctx.fns.http.loadRoutes(ctx);
            if (needTypes) await ctx.genTypes(ctx);
            if (needReload) ctx.fns.events.reload(ctx);
        } catch (e: any) {
            console.error(`[watch] post: ${e?.message ?? e}`);
        }
    };

    const watcher = watch(roots[0]!.dir, { recursive: true }, (_event, rel) => {
        if (!rel) return;
        if (rel.endsWith('.d.ts')) return; // genTypes output — would loop
        if (rel.split('/').some(s => /^(_runtime|_test_.*|_tmp_.*|tmp_.*)$/.test(s))) return;
        pending.add(rel);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { flush().catch(e => console.error('[watch]', e)); }, 100);
    });
    st.watcher = watcher;
    console.log(`[watch] watching ${roots[0]!.dir}`);
    return { watching: roots[0]!.dir };
}

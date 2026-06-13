// Scan src/ for function files and register raw fns into ctx.state.registry
// (ctx.fns is an injecting Proxy over it — see $main.ts). Root-level $name.ts
// become injecting getters directly on ctx (ctx.genTypes, ctx.layout, ...).
// Bootstrap: registry is empty when this runs, so we import project/scan
// directly for the first sweep.
import { relative, resolve } from "node:path";

export default async function (ctx: Context, _session: Session | null, _opts: {}): Promise<void> {
    const { default: scan } = await import("./project/scan?t=" + Date.now());
    const entries = await scan(ctx, null, {});

    for (const entry of entries) {
        // $config/$hook/$migration/$cli → collected into ctx.state (shared with
        // dev.sync/def so they hot-reload, not only at boot).
        if (entry.kind === 'config' || entry.kind === 'hook' || entry.kind === 'migration' || entry.kind === 'cli') {
            await collectStateFile(ctx, entry, entry.abs);
            continue;
        }
        if (entry.kind !== 'fn') continue;
        const mod = await import(entry.abs + `?t=${Date.now()}`);
        const fn = mod.default;
        if (typeof fn !== 'function') continue;
        if (entry.moduleDir === '.') {
            defineRootFn(ctx, entry.runtimeName, fn);
            console.log(`[fns] ctx.${entry.runtimeName}  ←  ${source(entry)}`);
        } else {
            setPath(ctx.state.registry, [...entry.moduleDir.split('/'), entry.runtimeName], fn);
            console.log(`[fns] ctx.fns.${entry.moduleDir.replaceAll('/', '.')}.${entry.runtimeName}  ←  ${source(entry)}`);
        }
    }
}

// Collect a $config/$hook/$migration/$cli file into ctx.state — idempotent
// (re-running replaces in place; migrations dedupe by id, not push). Shared by
// loadFns (boot) and dev.sync/def (hot-reload) so these conventions hot-load.
export async function collectStateFile(ctx: Context, entry: any, abs: string): Promise<void> {
    const mod = await import(abs + `?t=${Date.now()}`);
    const d = mod.default;
    if (entry.kind === 'config') {
        ((ctx.state as any).configSchemas ??= {})[entry.moduleDir] = d;
    } else if (entry.kind === 'hook') {
        if (typeof d === 'function') {
            const hooks = ((ctx.state as any).hooks ??= {});
            (hooks[entry.hookName] ??= new Map()).set(entry.moduleDir === '.' ? entry.hookName : entry.moduleDir, d);
        }
    } else if (entry.kind === 'migration') {
        if (d?.up) {
            const arr = ((ctx.state as any).migrations ??= []);
            const rec = { id: entry.migrationId, up: d.up, down: d.down };
            const i = arr.findIndex((m: any) => m.id === entry.migrationId);
            if (i >= 0) arr[i] = rec; else arr.push(rec);
        }
    } else if (entry.kind === 'cli') {
        if (typeof d === 'function') ((ctx.state as any).cli ??= {})[entry.command] = d;
    }
}

// Set value at a nested path in a tree, creating intermediate objects. Shared by
// loadFns and repl/load so registry nesting has ONE implementation.
export function setPath(root: any, segs: string[], value: any): void {
    let t = root;
    for (let i = 0; i < segs.length - 1; i++) t = (t[segs[i]!] ??= {});
    const last = segs[segs.length - 1]!;
    t[last] = value;
}

// A clean source label: the real file relative to the project root (plugins live
// outside src/, so entry.root + entry.rel would double the namespace).
export function source(entry: { abs: string }): string {
    return relative(resolve(import.meta.dir, ".."), entry.abs);
}

// Root fns are injecting getters: ctx.genTypes(opts) → raw(ctx, ctx.session, opts).
// `this` in the getter is the receiver, so request-ctxs inject their session.
export function defineRootFn(ctx: Context, name: string, fn: Function) {
    Object.defineProperty(ctx, name, {
        configurable: true,
        get() { const self = this; return (opts?: any) => fn(self, self.session, opts); },
    });
}

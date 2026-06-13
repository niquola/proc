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
        // $config.ts → collect the module's schema into ctx.state (so modules
        // read config via ctx.fns.config.resolve without importing $config).
        if (entry.kind === 'config') {
            const schema = (await import(entry.abs + `?t=${Date.now()}`)).default;
            ((ctx.state as any).configSchemas ??= {})[entry.moduleDir] = schema;
            continue;
        }
        // $hook_<name>.ts → register under the hook name (id = module).
        if (entry.kind === 'hook') {
            const fn = (await import(entry.abs + `?t=${Date.now()}`)).default;
            if (typeof fn === 'function') {
                const hooks = ((ctx.state as any).hooks ??= {});
                (hooks[entry.hookName] ??= new Map()).set(entry.moduleDir === '.' ? entry.hookName : entry.moduleDir, fn);
            }
            continue;
        }
        // $migration_<id>.ts → collect { id, up, down } for ctx.fns.migrate.
        if (entry.kind === 'migration') {
            const m = (await import(entry.abs + `?t=${Date.now()}`)).default;
            if (m?.up) ((ctx.state as any).migrations ??= []).push({ id: entry.migrationId, up: m.up, down: m.down });
            continue;
        }
        // $cli_<command>.ts → collect the command handler.
        if (entry.kind === 'cli') {
            const fn = (await import(entry.abs + `?t=${Date.now()}`)).default;
            if (typeof fn === 'function') ((ctx.state as any).cli ??= {})[entry.command] = fn;
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

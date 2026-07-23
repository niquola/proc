// Scan src/ for function files and register raw fns into ctx.state.registry
// (ctx.fns is an injecting Proxy over it — see $main.ts). Root-level $name.ts
// become injecting getters directly on ctx (ctx.genTypes, ctx.layout, ...).
// Bootstrap: registry is empty when this runs, so we import project/scan
// directly for the first sweep.
import { relative, resolve } from "node:path";

export default async function (ctx: Context, _session: Session | null, _opts: {}): Promise<void> {
    const { default: scan } = await import("./project/scan?t=" + Date.now());
    const { default: roots } = await import("./project/roots?t=" + Date.now());
    const entries = await scan(ctx, null, {});
    // One record per mounted plugin, kept on state so the tab strip (sync), the
    // manager and the agent's index all read the same thing. What the plugin IS
    // comes from its files: fns make it a library, a GET /<namespace> route makes
    // it a tab, a $hook_service makes it a provider — see $state_plugins.ts.
    const mounted: any[] = await roots(ctx, null, {});
    ctx.state.plugins = mounted.filter(r => r.namespace).sort((a, b) => a.namespace.localeCompare(b.namespace)).map(r => {
        const mine = entries.filter((e: any) => e.namespace === r.namespace);
        const routes = mine.filter((e: any) => e.kind === "route").map((e: any) => `${e.method} ${e.routePath}`);
        return {
            namespace: r.namespace,
            label: r.label ?? r.namespace.slice(0, 1).toUpperCase() + r.namespace.slice(1),
            icon: r.icon ?? "ph-squares-four",
            description: r.description ?? "",
            source: r.source ?? "core", from: r.from ?? null, dir: r.folder ?? r.dir, config: r.config ?? {},
            optional: r.optional === true,
            skill: r.skill ?? null,
            tab: routes.includes(`GET /${r.namespace}`),
            // A plugin may ship browser behaviour of its own; the layout loads it
            // on every page, so an hx-on--load in its markup can count on it.
            client: routes.includes(`GET /${r.namespace}/client.js`),
            fns: mine.filter((e: any) => e.kind === "fn").map((e: any) => dottedName(e)),
            routes,
            provides: mine.filter((e: any) => e.kind === "hook" && e.hookName.startsWith("service.")).map((e: any) => e.hookName.slice("service.".length)),
            preview: r.preview ?? null,
        };
    });

    for (const entry of entries) {
        // $config/$hook/$migration/$cli → collected into ctx.state (shared with
        // dev.sync/def so they hot-reload, not only at boot).
        if (STATE_KINDS.has(entry.kind)) {
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
            console.log(`[fns] ctx.fns.${dottedName(entry)}  ←  ${source(entry)}`);
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

// Convention-file kinds collected into ctx.state (not the fn registry). loadFns
// (boot) and dev.def/sync/watch (hot-reload) all branch on this same set, so it
// lives in ONE place — collectStateFile knows how to handle each.
export const STATE_KINDS = new Set(['config', 'hook', 'migration', 'cli']);

// The dotted registry name for a fn entry: "module.sub.fn", or just "fn" for a
// root $name.ts (moduleDir === '.'). ONE definition — def/sync/watch all build
// this name, and the "." special case is exactly what dev.def used to get wrong
// (it produced "..fn" for root fns, so repl.load couldn't find them).
export function dottedName(e: { moduleDir: string; runtimeName: string }): string {
    return e.moduleDir === '.' ? e.runtimeName : e.moduleDir.replaceAll('/', '.') + '.' + e.runtimeName;
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

// Scan src/ for function files and register raw fns into ctx.state.registry
// (ctx.fns is an injecting Proxy over it — see $main.ts). Root-level $name.ts
// become injecting getters directly on ctx (ctx.genTypes, ctx.layout, ...).
// Bootstrap: registry is empty when this runs, so we import project/scan
// directly for the first sweep.
export default async function (ctx: Context, _session: Session | null, _opts: {}): Promise<void> {
    const { default: scan } = await import("./project/scan?t=" + Date.now());
    const entries = await scan(ctx, null, {});
    const registry: any = (ctx.state as any).registry;

    for (const entry of entries) {
        if (entry.kind !== 'fn') continue;
        const mod = await import(entry.abs + `?t=${Date.now()}`);
        const fn = mod.default;
        if (typeof fn !== 'function') continue;
        const fnName = entry.runtimeName;
        if (entry.moduleDir === '.') {
            defineRootFn(ctx, fnName, fn);
            console.log(`[fns] ctx.${fnName}  ←  ${entry.root}/${entry.rel}`);
        } else {
            const segments = entry.moduleDir.split('/');
            let target: any = registry;
            for (const seg of segments) {
                target[seg] = target[seg] || {};
                target = target[seg];
            }
            target[fnName] = fn;
            console.log(`[fns] ctx.fns.${segments.join('.')}.${fnName}  ←  ${entry.root}/${entry.rel}`);
        }
    }
}

// Root fns are injecting getters: ctx.genTypes(opts) → raw(ctx, ctx.session, opts).
// `this` in the getter is the receiver, so request-ctxs inject their session.
export function defineRootFn(ctx: Context, name: string, fn: Function) {
    Object.defineProperty(ctx, name, {
        configurable: true,
        get() { const self = this; return (opts?: any) => fn(self, self.session, opts); },
    });
}

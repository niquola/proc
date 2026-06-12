// makeCtx: raw fns live in ctx.state.registry; ctx.fns is a Proxy that injects
// (ctx, ctx.session) into every call — `ctx.fns.notes.add({text})` actually
// calls rawAdd(ctx, ctx.session, {text}). The getter reads `this` throughout,
// so a derived ctx (Object.create + own session / env / state) injects ITSELF:
//   - request ctx: + session {req, params}        → session flows
//   - env ctx (env.fork): + env {NODE_ENV} + fresh state, shared registry
//     → a test environment coexists with dev in the same process
export function makeCtx(): Context {
    const ctx: any = {
        env: { ...process.env },
        state: { serverStart: Date.now(), registry: {} },
        routes: {},
        session: null,
    };
    Object.defineProperty(ctx, 'fns', {
        get() { return wrapFns(this, this.state.registry); },
    });
    return ctx as Context;
}

function wrapFns(ctx: any, node: any): any {
    return new Proxy(node, {
        get(target, prop) {
            const v = target[prop as any];
            if (typeof v === 'function') return (opts?: any) => v(ctx, ctx.session, opts);
            if (v && typeof v === 'object') return wrapFns(ctx, v);
            return v;
        },
    });
}

export default async function main() {
    const ctx = makeCtx();
    const { default: loadFns } = await import("./loadFns");
    await loadFns(ctx, null, {});
    const lint = await ctx.fns.dev.lint({});
    if (!lint.ok) console.error(`[boot] ${lint.errors.length} namespace lint error(s) — fix before building (see [lint] above)`);
    await ctx.genTypes({});
    await ctx.fns.http.loadRoutes({});
    await ctx.fns.http.start({});
    if (ctx.env.WATCH) await ctx.fns.dev.watch({}); // opt-in: WATCH=1 (the agent's primary path is ctx.fns.dev.def)
    return ctx;
}

if (import.meta.main) {
    const ctx = await main();
    (globalThis as any).ctx = ctx;
}

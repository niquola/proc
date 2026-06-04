// makeCtx: raw fns live in ctx.state.registry; ctx.fns is a Proxy that injects
// (ctx, ctx.session) into every call — `ctx.fns.notes.add({text})` actually
// calls rawAdd(ctx, ctx.session, {text}). The getter uses `this`, so a
// request ctx (Object.create(rootCtx) + session) injects ITS session.
export function makeCtx(): Context {
    const ctx: any = {
        env: { ...process.env },
        state: { serverStart: Date.now(), registry: {} },
        routes: {},
        session: null,
    };
    Object.defineProperty(ctx, 'fns', {
        get() { return wrapFns(this, ctx.state.registry); },
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

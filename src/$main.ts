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

// Derive a child ctx carrying a session — used by the server, http.dispatch and
// tests so request-scoped session construction lives in ONE place. Inherits the
// registry/routes/env; everything the handler calls via rctx.fns.* sees this
// session.
export function makeRequestCtx(base: Context, session: Session): Context {
    const c: any = Object.create(base);
    c.session = session;
    return c as Context;
}

export default async function main() {
    const ctx = makeCtx();
    const { default: loadFns } = await import("./loadFns");
    await loadFns(ctx, null, {});
    const lint = await ctx.fns.dev.lint({});
    if (!lint.ok) console.error(`[boot] ${lint.errors.length} namespace lint error(s) — fix before building (see [lint] above)`);
    await ctx.genTypes({});
    await ctx.fns.http.loadRoutes({});
    // Run module $start hooks in package.json proc.start order (db connects,
    // http serves, …). $stop runs in reverse on shutdown.
    await ctx.fns.lifecycle.start({});
    const shutdown = async (sig: string) => {
        console.log(`\n[${sig}] shutting down`);
        await ctx.fns.lifecycle.stop({});
        process.exit(0);
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    if (ctx.env.WATCH) await ctx.fns.dev.watch({}); // opt-in: WATCH=1 (the agent's primary path is ctx.fns.dev.def)
    return ctx;
}

if (import.meta.main) {
    const ctx = await main();
    (globalThis as any).ctx = ctx;
}

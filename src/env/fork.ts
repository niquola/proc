// Fork a coexisting environment from the live ctx — same code, isolated world.
// Returns a derived ctx that SHARES the function registry and routes (the
// injecting Proxy reads `this.state.registry`, which we carry over) but has its
// OWN env (mode) and OWN state, so its db connection / events / caches don't
// touch the parent's. This is what lets a test env live next to dev in one REPL:
//   const t = ctx.fns.env.fork({ mode: "test" });
//   await t.fns.db.connect({});               // test db, separate from dev's
//   const res = await t.fns.http.dispatch({ url: "/issues" });
export default function (ctx: Context, _session: Session | null, opts?: { mode?: "test" | "dev" | "prod"; env?: Record<string, string> }): Context {
    const mode = opts?.mode ?? "test";
    const NODE_ENV = mode === "prod" ? "production" : mode === "test" ? "test" : "development";
    const c: any = Object.create(ctx);
    c.env = { ...ctx.env, NODE_ENV, ...(opts?.env ?? {}) };
    c.state = { registry: (ctx.state as any).registry, serverStart: (ctx.state as any).serverStart }; // shared code, fresh app state
    c.routes = ctx.routes;        // share registered handlers (dispatch matches them)
    c.session = null;
    return c as Context;
}

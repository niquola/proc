// FUNCTIONAL test: src/env.test.ts ↔ the src/env/ namespace.
// Tests mode / pick and that a forked env coexists, isolated, in one process.
import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("env: testCtx runs in test mode → pick returns test config", () => {
    expect(ctx.fns.env.mode()).toBe("test");
    expect(ctx.fns.env.pick({ test: ":memory:", dev: "data/dev.db", prod: "PROD_URL" })).toBe(":memory:");
});

test("env.fork: coexisting env — own mode + state, shared registry", () => {
    const other = ctx.fns.env.fork({ mode: "dev" });
    expect(other.fns.env.mode()).toBe("dev");
    expect(other.fns.env.pick({ test: ":memory:", dev: "data/dev.db" })).toBe("data/dev.db");
    other.state.flag = "only-here";
    expect((ctx.state as any).flag).toBeUndefined();              // state isolated
    expect(other.state.registry).toBe((ctx.state as any).registry); // code shared
});

test("env.fork: carries the file-tree state (middleware runs through a fork)", async () => {
    ctx.state.middleware = [
        { prefix: "/g", segs: ["g"], handler: (_c: Context, s: Session) => { s.via = "mw"; } },
    ];
    ctx.routes["/g/x"] = { GET: (_c: Context, s: Session) => ({ via: s.via }) };
    const fork = ctx.fns.env.fork({ mode: "test" });             // forked AFTER routes/mw set
    expect(fork.state.middleware).toBe(ctx.state.middleware);    // shared by reference
    expect(await (await fork.fns.http.dispatch({ url: "/g/x" })).json()).toEqual({ via: "mw" });
    ctx.state.middleware = [];
    delete ctx.routes["/g/x"];
});

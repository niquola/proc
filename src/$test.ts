// Test harness — skipped by the scanner (stem "$test" is reserved), so it's
// never registered. Co-locate tests as src/<module>/<name>.test.ts and run
// `bun test` (or ctx.fns.dev.test from the REPL). Each test gets a real ctx
// with the full registry loaded but NO server/watcher:
//
//   import { test, expect } from "bun:test";
//   import { testCtx } from "../$test";
//   const ctx = await testCtx();
//   test("fib", async () => {
//     expect(await ctx.fns.math.fib({ n: 10 })).toEqual({ n: 10, fib: 55 });
//   });
import { makeCtx, makeRequestCtx } from "./$main";
import loadFns from "./loadFns";

// Fresh ctx per call → test files don't leak ctx.state into each other.
// Registry + routes loaded (so ctx.fns.http.dispatch can match), NODE_ENV=test
// (so ctx.fns.env.pick returns test config, e.g. an in-memory db), and NO
// server is started. loadFns/loadRoutes are cheap; we silence the load chatter.
export async function testCtx(): Promise<Context> {
    const ctx = makeCtx();
    ctx.env.NODE_ENV = "test";
    ctx.env.DATABASE_URL = ":memory:"; // test db, via config (env enters through config)
    const log = console.log;
    console.log = () => {};
    try {
        await loadFns(ctx, null, {});
        await ctx.fns.http.loadRoutes({});
    } finally { console.log = log; }
    return ctx;
}

// Request-scoped ctx + session, for testing route handlers / things that read
// the session (params, req). Anything it calls via ctx.fns.* sees this session.
export function reqCtx(ctx: Context, opts?: { params?: Record<string, string>; req?: Request }): Context {
    return makeRequestCtx(ctx, { kind: "test", params: opts?.params ?? {}, req: opts?.req });
}

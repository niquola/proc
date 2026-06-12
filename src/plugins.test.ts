// FUNCTIONAL test: src/plugins.test.ts ↔ the src/plugins/ namespace.
// The example plugin examples/hello (declared in package.json proc.plugins) is
// mounted by testCtx (which loads roots → resolves the plugin → registers it).
import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("plugin merges into the shared ctx.fns under its namespace", () => {
    // a plugin fn, calling a CORE fn (env.mode) through ctx — one shared world
    expect(ctx.fns.hello.world({ name: "x" })).toMatchObject({ hello: "x", from: "plugin", mode: "test" });
});

test("plugin route is namespace-prefixed and dispatchable", async () => {
    const res = await ctx.fns.http.dispatch({ url: "/hello/ping" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ from: "plugin" });
});

test("plugins.list reports the mounted plugin", async () => {
    const list = await ctx.fns.plugins.list({});
    expect(list.find((p: any) => p.namespace === "hello")).toMatchObject({ fns: 1, routes: 1 });
});

test("lint passes with the plugin merged in", async () => {
    expect((await ctx.fns.dev.lint({ silent: true })).ok).toBe(true);
});

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

// UNIT test: src/dev/lint.test.ts ↔ src/dev/lint.ts (one function).
import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

test("lint: the project itself is clean", async () => {
    const r = await ctx.fns.dev.lint({ silent: true });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
});

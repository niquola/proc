// UNIT test: src/repl/eval.test.ts ↔ src/repl/eval.ts.
import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

test("eval: last expression is the return value", async () => {
    expect((await ctx.fns.repl.eval({ code: "1 + 2" })).return).toBe(3);
});

test("eval: console.log is captured into output", async () => {
    expect((await ctx.fns.repl.eval({ code: "console.log('hi', 42)" })).output).toBe("hi 42");
});

test("eval: multiline object as last expression (brace tracking regression)", async () => {
    const r = await ctx.fns.repl.eval({ code: "let o;\no = {\n  a: 1,\n  b: 2\n}" });
    expect(r.return).toEqual({ a: 1, b: 2 });
});

import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("hooks: register + run (fan-out, in order) + first", async () => {
    ctx.fns.hooks.register({ name: "sum", id: "a", fn: (_c: Context, _s: Session | null, o: any) => o.n + 1 });
    ctx.fns.hooks.register({ name: "sum", id: "b", fn: (_c: Context, _s: Session | null, o: any) => o.n + 10 });
    expect(await ctx.fns.hooks.run({ name: "sum", opts: { n: 0 } })).toEqual([1, 10]);
    expect(await ctx.fns.hooks.first({ name: "sum", opts: { n: 0 } })).toBe(1);
    expect(await ctx.fns.hooks.run({ name: "none" })).toEqual([]);
});

test("hooks: $hook_<name>.ts auto-registers (hello plugin's greet)", async () => {
    const [greeting] = await ctx.fns.hooks.run({ name: "greet", opts: { name: "proc" } });
    expect(greeting).toContain("proc");
});

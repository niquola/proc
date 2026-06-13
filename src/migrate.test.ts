import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("migrate: up (in id order, idempotent) + status + down", async () => {
    ctx.state.migrations = [
        { id: "001_a", up: (c: Context) => c.fns.db.exec({ sql: "CREATE TABLE a (x INTEGER)" }), down: (c: Context) => c.fns.db.exec({ sql: "DROP TABLE a" }) },
        { id: "002_b", up: (c: Context) => c.fns.db.exec({ sql: "CREATE TABLE b (y INTEGER)" }) },
    ];
    expect((await ctx.fns.migrate.up({})).applied).toEqual(["001_a", "002_b"]);
    expect((await ctx.fns.migrate.up({})).applied).toEqual([]); // idempotent
    expect(ctx.fns.migrate.status({}).every((m: any) => m.applied)).toBe(true);

    expect((await ctx.fns.migrate.down({})).rolledBack).toEqual(["002_b"]); // last only
    expect(ctx.fns.migrate.status({}).find((m: any) => m.id === "002_b")!.applied).toBe(false);
});

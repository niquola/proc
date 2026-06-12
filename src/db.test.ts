// FUNCTIONAL test: src/db.test.ts ↔ src/db/ namespace.
import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("db: test env resolves to :memory:", () => {
    expect(ctx.fns.db.url()).toBe(":memory:");
});

test("db: exec / run / query round-trip", () => {
    ctx.fns.db.exec({ sql: "CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)" });
    expect(ctx.fns.db.run({ sql: "INSERT INTO t (v) VALUES (?)", params: ["hello"] }).changes).toBe(1);
    expect(ctx.fns.db.query({ sql: "SELECT v FROM t" })).toEqual([{ v: "hello" }]);
});

test("db lives in ctx → env.fork gives an isolated connection", () => {
    const a = ctx.fns.env.fork({ mode: "test" });
    const b = ctx.fns.env.fork({ mode: "test" });
    a.fns.db.exec({ sql: "CREATE TABLE x (n INTEGER)" });
    a.fns.db.run({ sql: "INSERT INTO x VALUES (1)" });
    b.fns.db.exec({ sql: "CREATE TABLE x (n INTEGER)" });          // b has its OWN :memory:
    expect(b.fns.db.query({ sql: "SELECT count(*) c FROM x" })).toEqual([{ c: 0 }]);
    expect(a.fns.db.query({ sql: "SELECT count(*) c FROM x" })).toEqual([{ c: 1 }]);
});

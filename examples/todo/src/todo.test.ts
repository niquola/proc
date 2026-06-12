// Tests for the standalone todo app. testCtx({ root }) boots THIS app's root —
// scanning examples/todo/src (the app, namespace "") + proc core — on an
// in-memory db, no server.
import { test, expect } from "bun:test";
import { resolve } from "node:path";
import { testCtx } from "../../../src/$test";

const ctx = await testCtx({ root: resolve(import.meta.dir, "..") });

test("todo: add / list / toggle / remove via ctx.fns", () => {
    const t = ctx.add({ title: "write tests" });
    expect(ctx.list({}).some((x: any) => x.id === t.id && x.done === 0)).toBe(true);
    ctx.toggle({ id: t.id });
    expect(ctx.list({}).find((x: any) => x.id === t.id).done).toBe(1);
    ctx.remove({ id: t.id });
    expect(ctx.list({}).find((x: any) => x.id === t.id)).toBeUndefined();
});

test("todo UI: POST /add renders the item; GET / shows it", async () => {
    const res = await ctx.fns.http.dispatch({ method: "POST", url: "/add", body: new URLSearchParams({ title: "buy milk" }) });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("buy milk");
    expect(await (await ctx.fns.http.dispatch({ url: "/" })).text()).toContain("buy milk");
});

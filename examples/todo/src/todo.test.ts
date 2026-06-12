// Tests for the todo example plugin. testCtx (the host harness) loads roots →
// resolves this plugin (declared in host package.json proc.plugins) → mounts it
// at ctx.fns.todo.*, on an in-memory db. No server.
import { test, expect } from "bun:test";
import { testCtx } from "../../../src/$test";

const ctx = await testCtx();

test("todo: add / list / toggle / remove via ctx.fns", () => {
    const t = ctx.fns.todo.add({ title: "write tests" });
    expect(ctx.fns.todo.list({}).some((x: any) => x.id === t.id && x.done === 0)).toBe(true);

    ctx.fns.todo.toggle({ id: t.id });
    expect(ctx.fns.todo.list({}).find((x: any) => x.id === t.id).done).toBe(1);

    ctx.fns.todo.remove({ id: t.id });
    expect(ctx.fns.todo.list({}).find((x: any) => x.id === t.id)).toBeUndefined();
});

test("todo UI: POST /todo/add renders the item (htmx fragment), page shows it", async () => {
    const res = await ctx.fns.http.dispatch({ method: "POST", url: "/todo/add", body: new URLSearchParams({ title: "buy milk" }) });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("buy milk");

    const page = await ctx.fns.http.dispatch({ url: "/todo" });
    expect(await page.text()).toContain("buy milk");
});

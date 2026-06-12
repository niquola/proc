// FUNCTIONAL test: src/todos.test.ts ↔ src/todos/ namespace.
// Real sqlite (in-memory under test), domain fns + REST via dispatch, no server.
import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("todos: migrate + add + list + GET /todos (dispatch)", async () => {
    ctx.fns.todos.migrate({});
    ctx.fns.todos.add({ title: "first" });
    ctx.fns.todos.add({ title: "second" });

    expect(ctx.fns.todos.list({}).map((t: any) => t.title)).toEqual(["first", "second"]);

    const res = await ctx.fns.http.dispatch({ url: "/todos" });
    expect(res.status).toBe(200);
    expect((await res.json() as any[]).length).toBe(2);
});

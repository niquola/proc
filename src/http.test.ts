// FUNCTIONAL test: src/http.test.ts ↔ the src/http/ namespace.
// Tests REST end-to-end WITHOUT a server, via http.dispatch (match → handler →
// toResponse). No socket, no port.
import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("dispatch: GET / → 200 html", async () => {
    const res = await ctx.fns.http.dispatch({ url: "/" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
});

test("dispatch: unknown route → 404", async () => {
    expect((await ctx.fns.http.dispatch({ url: "/nope" })).status).toBe(404);
});

test("middleware: prefix match, session mutation, short-circuit", async () => {
    ctx.state.middleware = [
        { prefix: "/guard", segs: ["guard"], handler: (_c: Context, s: Session) => { s.checked = true; } },
        { prefix: "/guard/secret", segs: ["guard", "secret"], handler: () => new Response("no", { status: 401 }) },
    ];
    ctx.routes["/guard/open"] = { GET: (_c: Context, s: Session) => ({ checked: s.checked }) };
    ctx.routes["/guard/secret"] = { GET: () => ({ ok: true }) };
    expect(await (await ctx.fns.http.dispatch({ url: "/guard/open" })).json()).toEqual({ checked: true });
    expect((await ctx.fns.http.dispatch({ url: "/guard/secret" })).status).toBe(401); // short-circuited
    ctx.state.middleware = [];
});

test("dispatch: :param + JSON body + JSON response", async () => {
    ctx.routes["/echo/:id"] = {
        POST: async (_c: Context, s: Session, o: { req: Request }) => ({ id: s.params!.id, body: await o.req.json() }),
    };
    const res = await ctx.fns.http.dispatch({ method: "POST", url: "/echo/42", body: { hi: 1 } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "42", body: { hi: 1 } });
});

// FUNCTIONAL test: src/auth.test.ts ↔ the src/auth/ namespace and the gate at
// src/$middleware.ts. The gate is the one piece where a mistake is silent — a
// workspace that thinks it is closed and is not looks exactly like one that is.
import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();
const closed = ctx.fns.env.fork({ mode: "test", env: { ...ctx.env, AUTH: "on" } });

test("off by default — the workspace is a local process and stays open", async () => {
    expect(ctx.fns.config.resolve({ module: "auth" }).mode).toBe("off");
    expect((await ctx.fns.http.dispatch({ url: "/filemanager" })).status).toBe(200);
});

test("a token carries who it is for, and verifies", async () => {
    const token = await closed.fns.auth.sign({ sub: "ada", name: "Ada Lovelace" });
    expect(await closed.fns.auth.verify({ token })).toMatchObject({ sub: "ada", name: "Ada Lovelace" });
    expect(await closed.fns.auth.verify({ token: token.slice(0, -3) + "aaa" })).toBe(null);
    expect(await closed.fns.auth.verify({ token: "not.a.token" })).toBe(null);
});

test("closed: a page asks for a login, everything else says no", async () => {
    const page = await closed.fns.http.dispatch({ url: "/filemanager", headers: { accept: "text/html" } });
    expect(page.status).toBe(302);
    expect(page.headers.get("location")).toBe("/auth/login?next=%2Ffilemanager");

    expect((await closed.fns.http.dispatch({ url: "/events" })).status).toBe(401);
    expect((await closed.fns.http.dispatch({ method: "POST", url: "/plugins/add" })).status).toBe(401);

    // the way in stays open, and so does the local tool
    expect((await closed.fns.http.dispatch({ url: "/auth/login" })).status).toBe(200);
});

test("closed: a session gets in, and the request knows whose it is", async () => {
    // A forked env has its own database, so the layout's transcript would fail
    // for reasons that have nothing to do with the gate — what is asserted here
    // is that the request got past it, and with a name attached.
    await closed.fns.migrate.up({});
    const token = await closed.fns.auth.sign({ sub: "ada", name: "Ada Lovelace" });
    const res = await closed.fns.http.dispatch({ url: "/filemanager", headers: { accept: "text/html", cookie: `workspace_session=${token}` } });
    expect(res.status).toBe(200);

    const req = new Request("http://localhost/filemanager", { headers: { cookie: `workspace_session=${token}` } });
    expect(await closed.fns.auth.authenticate({ req })).toMatchObject({ name: "Ada Lovelace" });
});

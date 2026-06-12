// FUNCTIONAL test: src/lifecycle.test.ts ↔ the src/lifecycle/ namespace.
// (We don't run start/stop here — that would boot the http server; the boot
// path is verified live. Here we cover the package.json-driven order + config.)
import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("lifecycle.order reads package.json proc.start", async () => {
    expect(await ctx.fns.lifecycle.order({})).toEqual(["db", "http"]);
});

test("lifecycle.config merges proc.config + <MODULE>__<KEY> env vars", async () => {
    ctx.env.DB__URL = "from-env.sqlite";
    expect((await ctx.fns.lifecycle.config({ module: "db" })).url).toBe("from-env.sqlite");
});

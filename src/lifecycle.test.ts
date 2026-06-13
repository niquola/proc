// FUNCTIONAL test: src/lifecycle.test.ts ↔ the src/lifecycle/ namespace.
// (We don't run start/stop here — that would boot the http server; the boot
// path is verified live. Here we cover the package.json-driven start order.)
import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("lifecycle.order reads package.json proc.prod keys (http last)", async () => {
    expect(await ctx.fns.lifecycle.order({})).toEqual(["db", "migrate", "http"]);
});

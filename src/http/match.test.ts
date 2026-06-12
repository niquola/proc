// UNIT test: src/http/match.test.ts ↔ src/http/match.ts (one function).
import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

test("match: exact route, no params", () => {
    ctx.routes = { "/a": { GET: () => 1 } };
    expect(ctx.fns.http.match({ method: "GET", pathname: "/a" })).toMatchObject({ params: {} });
});

test("match: nested :param extraction", () => {
    ctx.routes = { "/billing/invoices/:id": { GET: () => 1 } };
    expect(ctx.fns.http.match({ method: "GET", pathname: "/billing/invoices/42" })?.params).toEqual({ id: "42" });
});

test("match: wrong method → null", () => {
    ctx.routes = { "/a": { GET: () => 1 } };
    expect(ctx.fns.http.match({ method: "POST", pathname: "/a" })).toBeNull();
});

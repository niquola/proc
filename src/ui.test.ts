// FUNCTIONAL test: src/ui.test.ts ↔ the src/ui/ namespace — and the one rule
// that makes a page drivable at all. The workspace shows plugin pages to the
// user by pointing at their data-* markers; a page without them is a page the
// agent cannot show anyone, so this is checked for every mounted tab rather
// than left to whoever wrote it.
import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("attr emits the markers, drops the empty ones and escapes values", () => {
    expect(ctx.fns.ui.attr({ entity: "file", id: "src/a.ts" })).toBe(`data-entity="file" data-id="src/a.ts"`);
    expect(ctx.fns.ui.attr({ entity: "file", id: undefined, status: "" })).toBe(`data-entity="file"`);
    expect(ctx.fns.ui.attr({ id: `a"b` })).toBe(`data-id="a&quot;b"`);
});

test("every mounted tab names itself with exactly one data-page", async () => {
    const tabs = ctx.fns.plugins.list({}).filter(p => p.tab);
    expect(tabs.length).toBeGreaterThan(0);
    for (const plugin of tabs) {
        const html = await (await ctx.fns.http.dispatch({ url: `/${plugin.namespace}` })).text();
        const pages = html.match(/data-page="[^"]*"/g) ?? [];
        expect({ tab: plugin.namespace, pages }).toEqual({ tab: plugin.namespace, pages: [pages[0] ?? "MISSING data-page"] });
    }
});

test("the components carry the markers, so a page built from them cannot forget", () => {
    const html = ctx.fns.ui.page({
        page: "demo",
        title: "Demo",
        main: ctx.fns.ui.box({
            title: "1 item",
            right: ctx.fns.ui.button({ action: "refresh", label: "Refresh", get: "/x" }),
            body: ctx.fns.ui.row({ entity: "thing", id: "one", status: "draft", href: "/x", cells: [{ role: "name", text: "One" }] })
                + ctx.fns.ui.form({ form: "search", get: "/x", body: ctx.fns.ui.field({ name: "q" }) }),
        }),
    });
    expect(html.match(/data-[a-z]+="[^"]*"/g)).toEqual([
        `data-page="demo"`, `data-action="refresh"`,
        `data-entity="thing"`, `data-id="one"`, `data-status="draft"`, `data-role="name"`,
        `data-form="search"`, `data-field="q"`,
    ]);
});

test("a listing's rows are addressable — entity plus a stable id", async () => {
    const html = await (await ctx.fns.http.dispatch({ url: "/filemanager" })).text();
    expect(html).toContain(`data-entity=`);
    // every entity marker on the page is paired with an id, or nothing can point at it
    const entities = html.match(/data-entity="[^"]*"[^>]*/g) ?? [];
    expect(entities.filter(e => !e.includes("data-id="))).toEqual([]);
});

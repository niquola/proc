// FUNCTIONAL test: src/plugins.test.ts ↔ the src/plugins/ namespace.
// The workspace's own plugins/ directory is what testCtx mounts (roots →
// pluginPaths → atomic-workspace.json), so the assertions below are about the
// real filemanager plugin rather than a fixture kept alive only for a test.
import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("plugin merges into the shared ctx.fns under its namespace", async () => {
    // a plugin fn, calling a CORE fn (project.workdir) through ctx — one shared world
    const listing = await ctx.fns.filemanager.list({});
    expect(listing.workdir).toBe(ctx.fns.project.workdir({}));
    expect(Array.isArray(listing.files)).toBe(true);
});

test("plugin route is namespace-prefixed and dispatchable", async () => {
    const res = await ctx.fns.http.dispatch({ url: "/filemanager" });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("items");
});

test("plugins.list reports the mounted plugins — the workspace's own, not the catalogue", async () => {
    const list = await ctx.fns.plugins.list({});
    expect(list.map((p: any) => p.namespace).sort()).toEqual(["aidbox", "filemanager", "preview", "processes"]);
    // an "optional": true manifest ships with the workspace but waits to be named
    expect((await ctx.fns.plugins.catalog({})).map((p: any) => p.namespace)).toContain("questionnaire");
});

test("a plugin's faces are read off its files, not declared", async () => {
    const byName = Object.fromEntries(ctx.fns.plugins.list({}).map(p => [p.namespace, p]));
    // filemanager answers GET /filemanager → it is a tab; its fns are the library
    expect(byName.filemanager!.tab).toBe(true);
    expect(byName.filemanager!.fns).toContain("filemanager.listing");
    // aidbox ships $hook_service.aidbox.ts → it can provide the aidbox service
    expect(byName.aidbox!.provides).toEqual(["aidbox"]);
    // the workspace's own plugins are always on — nothing declares them
    expect(byName.preview!.source).toBe("core");
});

test("the catalogue is what is NOT mounted", async () => {
    const mounted = ctx.fns.plugins.list({}).map(p => p.namespace);
    const catalog = await ctx.fns.plugins.catalog({});
    expect(catalog.some(p => mounted.includes(p.namespace))).toBe(false);
});

test("workspace.json says which plugins the project wants", async () => {
    expect(await ctx.fns.plugins.readDeclared({ workdir: "/nonexistent" })).toEqual({});
});

test("lint passes with the plugins merged in", async () => {
    expect((await ctx.fns.dev.lint({ silent: true })).ok).toBe(true);
});

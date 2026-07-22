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

test("plugins.list reports the mounted plugins", async () => {
    const list = await ctx.fns.plugins.list({});
    expect(list.map((p: any) => p.namespace).sort()).toEqual(["aidbox", "filemanager", "form", "preview", "processes"]);
});

test("lint passes with the plugins merged in", async () => {
    expect((await ctx.fns.dev.lint({ silent: true })).ok).toBe(true);
});

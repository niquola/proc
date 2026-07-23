// Re-read the manifest and remount everything: the whole point of the plugin
// system is that installing one is an edit to workspace.json plus this call —
// no restart, no lost chat session. Routes and root fns live on the ROOT ctx
// (loadRoutes assigns ctx.routes on the object it is called on), so walk up to
// it before reloading; a REPL eval runs two prototypes below.
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    let root: any = ctx;
    while (Object.getPrototypeOf(root) !== Object.prototype) root = Object.getPrototypeOf(root);

    await root.fns.plugins.fetch({});
    await root.loadFns({});
    const lint = await root.fns.dev.lint({ silent: true });
    if (!lint.ok) throw new Error("plugins rejected by lint:\n" + lint.errors.map((e: string) => "  ✗ " + e).join("\n"));
    await root.genTypes({});
    await root.fns.http.loadRoutes({});
    // The tab strip is server-rendered: the manager's own POSTs get it back as an
    // out-of-band swap, and a REPL caller shows the result with page.open.
    return root.fns.plugins.list({});
}

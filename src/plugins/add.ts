// Ask for a plugin: write it into WORKDIR/workspace.json, fetch it if it comes
// from a repo, and remount. Installing is a manifest edit — that is the whole
// design, so the project carries its own tools and a fresh checkout comes up
// with them.
//
//   plugins.add({ name: "fhir-viewer" })                                  // platform, by name
//   plugins.add({ name: "billing", git: "https://github.com/acme/x" })    // external repo
//   plugins.add({ name: "labs", path: "./tools/labs" })                   // shipped by the project
//   plugins.add({ name: "aidbox", config: { license: "…" } })             // configure a mounted one
export default async function (ctx: Context, _session: Session | null, opts: { name: string; git?: string; path?: string; config?: Record<string, any> }) {
    if (ctx.fns.env.mode() === "prod") throw new Error("plugins.add is dev-only (it loads third-party code)");
    const name = opts.name.trim();
    if (!name) throw new Error("plugins.add: name is required");

    const file = `${ctx.fns.project.workdir({})}/workspace.json`;
    const manifest = await Bun.file(file).json().catch(() => ({} as any));
    manifest.plugins ??= {};
    manifest.plugins[name] = { ...manifest.plugins[name], ...opts.config, ...(opts.git ? { git: opts.git } : {}), ...(opts.path ? { path: opts.path } : {}) };
    await Bun.write(file, JSON.stringify(manifest, null, 2) + "\n");

    const mounted = (await ctx.fns.plugins.reload({})).find((p: any) => p.namespace === name);
    if (!mounted) throw new Error(`"${name}" is declared but did not mount — no plugin by that name in the catalogue, and no git/path to fetch it from`);
    return mounted;
}

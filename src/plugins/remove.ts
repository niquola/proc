// Drop a plugin from WORKDIR/workspace.json and remount. The clone under
// .workspace/plugins stays where it is — removing is un-asking, not deleting, so
// adding it back costs nothing. (The fns it registered live in the running
// registry until a restart, like any deleted file; routes and types rebuild
// immediately, so its tab goes at once.)
export default async function (ctx: Context, _session: Session | null, opts: { name: string }) {
    const file = `${ctx.fns.project.workdir({})}/workspace.json`;
    const manifest = await Bun.file(file).json().catch(() => ({} as any));
    if (!manifest.plugins?.[opts.name]) throw new Error(`"${opts.name}" is not declared in workspace.json`);
    delete manifest.plugins[opts.name];
    await Bun.write(file, JSON.stringify(manifest, null, 2) + "\n");

    await ctx.fns.plugins.reload({});
    return { removed: opts.name };
}

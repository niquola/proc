// Remove a plugin's declaration from host package.json and remount. (Note:
// the fns it added stay in the in-memory registry until restart — like any
// deleted file; routes/types are rebuilt fresh and drop immediately.)
import { resolve } from "node:path";

export default async function (ctx: Context, _session: Session | null, opts: { from: string }) {
    const from = opts.from;
    const projectRoot = ctx.fns.project.projectRoot({});
    const pkgPath = projectRoot + "/package.json";

    const pkg = JSON.parse(await Bun.file(pkgPath).text());
    const before = (pkg.proc?.plugins ?? []).length;
    if (pkg.proc?.plugins) pkg.proc.plugins = pkg.proc.plugins.filter((p: any) => p.from !== from);
    await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

    await ctx.genTypes({});
    await ctx.fns.http.loadRoutes({});
    return { removed: from, declarationsRemoved: before - (pkg.proc?.plugins?.length ?? 0) };
}

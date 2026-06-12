// Install + mount a plugin on the fly (no restart).
//   ctx.fns.plugins.add({ from: "proc-auth" })                 // npm
//   ctx.fns.plugins.add({ from: "github:acme/proc-billing" })  // git
//   ctx.fns.plugins.add({ from: "file:./examples/hello" })     // local
// `from` is exactly what `bun add` takes (Bun pulls the plugin's deps too).
// Persists the entry in host package.json "proc.plugins" so boot re-mounts it.
import { resolve, dirname } from "node:path";
import { readFileSync } from "node:fs";

function pluginNamespace(from: string, projectRoot: string): string | null {
    let f = from.startsWith("file:") ? from.slice(5) : from;
    let dir: string;
    if (f.startsWith(".") || f.startsWith("/")) dir = resolve(projectRoot, f);
    else { try { dir = dirname(Bun.resolveSync(f + "/package.json", projectRoot)); } catch { return null; } }
    try { return JSON.parse(readFileSync(dir + "/package.json", "utf8")).proc?.namespace ?? null; }
    catch { return null; }
}

export default async function (ctx: Context, _session: Session | null, opts: { from: string }) {
    if (ctx.fns.env.mode() === "prod") throw new Error("plugins.add is dev-only (loads third-party code)");
    const from = opts.from;
    const projectRoot = ctx.fns.project.projectRoot({});
    const pkgPath = projectRoot + "/package.json";

    // 1. install (npm/git/local) — Bun resolves transitive deps into node_modules
    await Bun.$`bun add ${from}`.cwd(projectRoot).quiet();

    // 2. persist the declaration so boot re-mounts it
    const pkg = JSON.parse(await Bun.file(pkgPath).text());
    pkg.proc ??= {};
    pkg.proc.plugins ??= [];
    if (!pkg.proc.plugins.some((p: any) => p.from === from)) pkg.proc.plugins.push({ from });
    await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

    // 3. remount the whole project (re-scan roots → register everything), then
    //    lint (catches namespace collisions with core / other plugins) → types → routes
    await ctx.loadFns({});
    const lint = await ctx.fns.dev.lint({ silent: true });
    if (!lint.ok) throw new Error(`plugin "${from}" rejected by lint:\n` + lint.errors.map((e: string) => "  ✗ " + e).join("\n"));
    await ctx.genTypes({});
    await ctx.fns.http.loadRoutes({});

    const namespace = pluginNamespace(from, projectRoot);
    const mounted = (await ctx.fns.plugins.list({})).find((p: any) => p.namespace === namespace);
    return { installed: from, namespace, fns: mounted?.fns ?? 0, routes: mounted?.routes ?? 0 };
}

import { resolve, dirname } from "node:path";
import { readdir } from "node:fs/promises";
// Bootstrap path: roots runs before the registry exists, so these are imported
// directly rather than called through ctx.fns.
import projectRootFn from "./projectRoot";
import pluginPaths from "./pluginPaths";

// Scan roots = the app's src/ (namespace "") + proc's own core src (the
// framework: http/repl/dev/config/lifecycle/…) + each declared plugin's src.
// When running proc itself, the app root IS proc's root, so app src === core src
// and there is just one. When an app boots proc as a dependency (boot({root})),
// there are two: the app's code and proc's core, merged into one ctx.fns.
// Plugins come from the APP's package.json (ctx.state.root).
export type Root = { name: string; dir: string; namespace: string };

export default async function (ctx: Context, session: Session | null, _opts?: {}): Promise<Root[]> {
    const coreSrc = resolve(import.meta.dir, "..");        // proc/src — this file lives in src/project/
    const projectRoot = projectRootFn(ctx, session, {});   // boot({root}) / proc's repo root
    const appSrc = resolve(projectRoot, "src");

    // core first, then app — so the app OVERRIDES core defaults (e.g. its own
    // GET / home page wins over proc's registry-listing home).
    const out: Root[] = [{ name: "core", dir: coreSrc, namespace: "" }];
    if (appSrc !== coreSrc) out.push({ name: "app", dir: appSrc, namespace: "" });

    // An app declared `runtime: "in-process"` in workspace.json is mounted from
    // WORKDIR as a namespace of this process — services/start puts the directory
    // here and calls loadFns. It is a plugin in everything but where it lives.
    for (const [namespace, dir] of Object.entries(ctx.state.appRoots ?? {})) {
        out.push({ name: namespace, dir: dir as string, namespace });
    }

    let specs: Array<{ from: string; as?: string }> = [];
    try {
        const pkg = JSON.parse(await Bun.file(projectRoot + "/package.json").text());
        specs = pkg.proc?.plugins ?? [];
    } catch { /* no host package.json / no proc.plugins */ }

    for (const spec of specs) {
        try {
            const dir = resolvePluginDir(spec.from, projectRoot);
            if (!dir) { console.warn(`[plugins] cannot resolve "${spec.from}" — run bun add first?`); continue; }
            const man = JSON.parse(await Bun.file(dir + "/package.json").text()).proc;
            if (!man?.namespace) { console.warn(`[plugins] ${spec.from}: package.json has no proc.namespace`); continue; }
            const ns = spec.as ?? man.namespace;
            out.push({ name: ns, dir: resolve(dir, man.src ?? "src"), namespace: ns });
        } catch (e: any) {
            console.warn(`[plugins] skip "${spec.from}": ${e?.message ?? e}`);
        }
    }

    // Any directory under PLUGIN_PATHS that ships an atomic-workspace.json is a
    // plugin: the project's own plugins/ and every skill directory.
    for (const searchDir of await pluginPaths(ctx, session, {})) {
        for (const name of await readdir(searchDir).catch(() => [] as string[])) {
            const dir = resolve(searchDir, name);
            const man = await Bun.file(dir + "/atomic-workspace.json").json().catch(() => null);
            if (!man) continue;
            const ns = man.namespace ?? name;
            out.push({ name: ns, dir: resolve(dir, man.src ?? "src"), namespace: ns });
        }
    }

    const exist: Root[] = [];
    for (const r of out) {
        if (await Bun.file(r.dir).stat().then(() => true).catch(() => false)) exist.push(r);
        else console.warn(`[plugins] ${r.name}: src dir not found: ${r.dir}`);
    }
    return exist;
}

function resolvePluginDir(from: string, projectRoot: string): string | null {
    let f = from.startsWith("file:") ? from.slice(5) : from;
    if (f.startsWith(".") || f.startsWith("/")) return resolve(projectRoot, f);
    try { return dirname(Bun.resolveSync(f + "/package.json", projectRoot)); } catch { return null; }
}

import { resolve, dirname } from "node:path";
import { readdir } from "node:fs/promises";
// Bootstrap path: roots runs before the registry exists, so these are imported
// directly rather than called through ctx.fns.
import projectRootFn from "./projectRoot";
import workdirFn from "./workdir";
import pluginPaths from "./pluginPaths";
import readDeclared from "../plugins/readDeclared";
import describe from "../plugins/describe";

// Scan roots = the app's src/ (namespace "") + proc's own core src (the
// framework: http/repl/dev/config/lifecycle/…) + each mounted plugin's src.
// When running proc itself, the app root IS proc's root, so app src === core src
// and there is just one. When an app boots proc as a dependency (boot({root})),
// there are two: the app's code and proc's core, merged into one ctx.fns.
//
// A plugin reaches this list one of three ways, and the tier is what the
// workspace shows and what WORKDIR/workspace.json can change:
//   core      the workspace's own plugins/     part of the workspace
//   project   WORKDIR/.claude/skills/*         the project's own — and the coding agent
//                                              reads the same folders as skills
//   platform  a global skill dir               everything on the machine
//   external  a git repo                       "x": { "git": … } — cloned into .claude/skills
//
// Mounted unless it is optional and nobody asked: a manifest that says
// `"optional": true` waits to be named in workspace.json, and a global skill
// directory is optional by nature — a machine has dozens, a project wants three.
// The ones skipped here are exactly what plugins.catalog offers.
export type Root = {
    name: string; dir: string; namespace: string;
    folder?: string;   // the plugin directory itself — manifest and SKILL.md live here
    label?: string; icon?: string; description?: string; skill?: string | null;
    source?: "core" | "project" | "platform" | "external"; from?: string | null;
    optional?: boolean; preview?: { files: string; fn: string } | null; config?: Record<string, any>;
};

export default async function (ctx: Context, session: Session | null, _opts?: {}): Promise<Root[]> {
    const coreSrc = resolve(import.meta.dir, "..");        // proc/src — this file lives in src/project/
    const projectRoot = projectRootFn(ctx, session, {});   // boot({root}) / proc's repo root
    const appSrc = resolve(projectRoot, "src");
    const workdir = workdirFn(ctx, session, {});

    // core first, then app — so the app OVERRIDES core defaults (e.g. its own
    // GET / home page wins over proc's registry-listing home).
    const out: Root[] = [{ name: "core", dir: coreSrc, namespace: "" }];
    if (appSrc !== coreSrc) out.push({ name: "app", dir: appSrc, namespace: "" });

    // An app declared `runtime: "in-process"` in workspace.json is mounted from
    // WORKDIR as a namespace of this process — services/start puts the directory
    // here and calls loadFns. It is a plugin in everything but where it lives.
    for (const [namespace, dir] of Object.entries(ctx.state.appRoots ?? {})) {
        // The project's own app, declared under services — not something the
        // plugin manager can remove, so it is listed as part of the workspace.
        out.push({ name: namespace, dir: dir as string, namespace, icon: "ph-app-window", source: "core", from: dir as string });
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
            const manifest = JSON.parse(await Bun.file(dir + "/package.json").text()).proc;
            if (!manifest?.namespace) { console.warn(`[plugins] ${spec.from}: package.json has no proc.namespace`); continue; }
            const namespace = spec.as ?? manifest.namespace;
            out.push({
                ...await describe(ctx, session, { dir, namespace, manifest }),
                name: namespace, dir: resolve(dir, manifest.src ?? "src"), folder: dir, namespace, source: "external", from: spec.from,
            });
        } catch (e: any) {
            console.warn(`[plugins] skip "${spec.from}": ${e?.message ?? e}`);
        }
    }

    const declared = await readDeclared(ctx, session, { workdir });
    const own = resolve(projectRoot, "plugins");

    // Any directory under PLUGIN_PATHS holding an atomic-workspace.json is a
    // plugin. The workspace's own and the project's own are always on; the
    // global skill directories are a catalogue the project opts into by name.
    for (const searchDir of await pluginPaths(ctx, session, {})) {
        for (const name of await readdir(searchDir).catch(() => [] as string[])) {
            const dir = resolve(searchDir, name);
            const manifest = await Bun.file(dir + "/atomic-workspace.json").json().catch(() => null);
            if (!manifest) continue;
            const namespace = manifest.namespace ?? name;
            const source = searchDir === own ? "core" : searchDir.startsWith(workdir + "/") ? "project" : "platform";
            const optional = manifest.optional === true || source === "platform";
            if (optional && !(namespace in declared)) continue;
            out.push({
                ...await describe(ctx, session, { dir, namespace, manifest }),
                name: namespace, dir: resolve(dir, manifest.src ?? "src"), folder: dir, namespace, source, optional, config: declared[namespace] ?? {},
            });
        }
    }

    // External: a repo plugins.fetch cloned into WORKDIR/.claude/skills, or a
    // folder the project ships somewhere else.
    for (const [namespace, config] of Object.entries(declared)) {
        const from = config.git ?? config.path;
        if (!from) continue;
        const dir = config.path ? resolve(workdir, config.path) : `${workdir}/.claude/skills/${namespace}`;
        const manifest = await Bun.file(dir + "/atomic-workspace.json").json().catch(() => null);
        if (!manifest) { console.warn(`[plugins] ${namespace}: not fetched yet (${from}) — ctx.fns.plugins.fetch({})`); continue; }
        out.push({
            ...await describe(ctx, session, { dir, namespace, manifest }),
            name: namespace, dir: resolve(dir, manifest.src ?? "src"), folder: dir, namespace, source: "external", from, optional: true, config,
        });
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

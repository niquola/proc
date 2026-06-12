import { resolve, dirname } from "node:path";

// Scan roots = the app's src/ (namespace "") + each declared plugin's src dir
// (namespace from the plugin's package.json "proc" field). Plugins are listed
// in the HOST package.json: { "proc": { "plugins": [{ "from": "<spec>" }] } }
// where <spec> is what you'd pass to `bun add`: a local "file:./path"/"./path",
// an npm name, or "github:user/repo". A broken/missing plugin is logged + skipped
// (never kills boot).
export type Root = { name: string; dir: string; namespace: string };

export default async function (_ctx: Context, _session: Session | null, _opts?: {}): Promise<Root[]> {
    const srcDir = resolve(import.meta.dir, "..");
    const projectRoot = resolve(srcDir, "..");
    const out: Root[] = [{ name: "src", dir: srcDir, namespace: "" }];

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
            // `as` lets the host remount a plugin under a different namespace to
            // resolve a collision without touching the plugin.
            const ns = spec.as ?? man.namespace;
            out.push({ name: ns, dir: resolve(dir, man.src ?? "src"), namespace: ns });
        } catch (e: any) {
            console.warn(`[plugins] skip "${spec.from}": ${e?.message ?? e}`);
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
    // installed (npm / git via bun add) → resolve its package.json in node_modules
    try { return dirname(Bun.resolveSync(f + "/package.json", projectRoot)); } catch { return null; }
}

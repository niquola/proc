import { Glob } from "bun";
import { resolve } from "node:path";
import classify from "./classify";
import type { ProjectEntry } from "./classify";

// Directory segments that are runtime/test/scratch — never part of the app.
const IGNORED_SEGMENT = /^(_runtime|_test_.*|_tmp_.*|tmp_.*|node_modules)$/;
function isIgnoredPath(rel: string): boolean {
    return rel.split('/').some(seg => IGNORED_SEGMENT.test(seg));
}

export type ScanEntry = ProjectEntry & { root: string; rootDir: string; namespace: string; abs: string };

export default async function (ctx: Context, session: Session | null, _opts?: {}): Promise<ScanEntry[]> {
    // ctx.fns.project.roots may not be registered yet on the first bootstrap
    // pass (loadFns calls scan to populate the registry) — fall back to a
    // direct import (raw call, explicit args).
    const roots = ctx.fns.project?.roots
        ? await ctx.fns.project.roots({})
        : await (await import("./roots?t=" + Date.now())).default(ctx, session, {});
    const entries: ScanEntry[] = [];
    for (const root of roots) {
        const ns: string = root.namespace ?? "";
        const glob = new Glob('**/*');
        for await (const rel of glob.scan(root.dir)) {
            if (isIgnoredPath(rel)) continue;
            // Prefix the plugin's namespace onto the path BEFORE classify, so the
            // dotted registry path / route path is namespaced — but keep `abs`
            // pointing at the real file (which lives under the plugin's dir).
            const nsRel = ns ? ns + '/' + rel : rel;
            const meta = classify(ctx, session, { rel: nsRel });
            entries.push({ ...meta, root: root.name, rootDir: root.dir, namespace: ns, abs: resolve(root.dir, rel) });
        }
    }
    return entries;
}

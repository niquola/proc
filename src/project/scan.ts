import { Glob } from "bun";
import { resolve } from "node:path";
import classify from "./classify";
import type { ProjectEntry } from "./classify";

// Directory segments that are runtime/test/scratch — never part of the app.
const IGNORED_SEGMENT = /^(_runtime|_test_.*|_tmp_.*|tmp_.*)$/;
function isIgnoredPath(rel: string): boolean {
    return rel.split('/').some(seg => IGNORED_SEGMENT.test(seg));
}

export type ScanEntry = ProjectEntry & { root: string; rootDir: string; abs: string };

export default async function (ctx: Context): Promise<ScanEntry[]> {
    // ctx.fns.project.roots may not be loaded yet on the first bootstrap pass
    // (loadFns calls scan to populate ctx.fns) — fall back to a direct import.
    const rootsFn = ctx.fns.project?.roots ?? (await import("./roots?t=" + Date.now())).default;
    const roots = await rootsFn(ctx);
    const entries: ScanEntry[] = [];
    for (const root of roots) {
        const glob = new Glob('**/*');
        for await (const rel of glob.scan(root.dir)) {
            if (isIgnoredPath(rel)) continue;
            const meta = classify(rel);
            entries.push({ ...meta, root: root.name, rootDir: root.dir, abs: resolve(root.dir, rel) });
        }
    }
    return entries;
}

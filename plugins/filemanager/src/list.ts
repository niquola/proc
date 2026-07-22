import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

// List one directory under WORKDIR. `path` is relative to it; escaping the
// workdir is refused so a URL cannot walk the whole filesystem.
export default async function (ctx: Context, _session: Session | null, opts: { path?: string }) {
    const workdir = ctx.fns.project.workdir({});
    const dir = resolve(workdir, opts.path ?? ".");
    if (dir !== workdir && !dir.startsWith(workdir + "/")) throw new Error(`outside workdir: ${dir}`);

    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async e => ({
        name: e.name,
        path: relative(workdir, join(dir, e.name)),
        dir: e.isDirectory(),
        size: e.isDirectory() ? 0 : await Bun.file(join(dir, e.name)).stat().then(s => s.size).catch(() => 0),
    })));
    files.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
    return { workdir, path: relative(workdir, dir), files };
}

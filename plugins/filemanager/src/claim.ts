// Ask the mounted plugins whether one of them owns this file. A plugin claims a
// pattern in its manifest — `"preview": { "files": "$qr_*.json", "fn": "preview" }`
// — and gets called with the path; returning null hands the file back, which is
// what a plugin does when it cannot make sense of this particular one.
//
// The pattern is matched against the file name unless it contains a slash, in
// which case it is matched against the path inside the project: `$qr_*.json`
// means "anywhere", `src/forms/*.json` means "there".
import { Glob } from "bun";
import { basename } from "node:path";

export default async function (ctx: Context, _session: Session | null, opts: { path: string }): Promise<string | null> {
    for (const plugin of ctx.state.plugins ?? []) {
        if (!plugin.preview) continue;
        const { files, fn } = plugin.preview;
        if (!new Glob(files).match(files.includes("/") ? opts.path : basename(opts.path))) continue;
        const render = (ctx.fns as any)[plugin.namespace]?.[fn];
        if (!render) { console.warn(`[filemanager] ${plugin.namespace} claims ${files} but has no ${fn}`); continue; }
        const html = await render({ path: opts.path });
        if (html) return html;
    }
    return null;
}

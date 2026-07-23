// A directory the way GitHub shows one: the path as a heading, a bordered table
// with an icon, a name and how long ago it changed, and the README rendered
// underneath in its own box. Sorting is folders first, then alphabetical —
// nothing clever, because a file tree read by a human is read by its names.
import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";

const README = /^readme(\.md|\.markdown|\.txt)?$/i;

export default async function (ctx: Context, _session: Session | null, opts: { dir: string }) {
    const workdir = ctx.fns.project.workdir({});
    const dir = opts.dir;
    const here = relative(workdir, dir);

    const entries = (await Promise.all((await readdir(dir)).map(async name => {
        const info = await stat(join(dir, name)).catch(() => null);
        return info && { name, path: relative(workdir, join(dir, name)), dir: info.isDirectory(), size: info.size, mtime: info.mtime };
    }))).filter(Boolean) as any[];
    entries.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));

    const up = here
        ? `<tr class="border-t border-border-subtle first:border-t-0 hover:bg-bg-tertiary">
      <td class="px-4 py-2" colspan="3">${cell(ctx, { name: "..", path: relative(workdir, dirname(dir)) || ".", dir: true })}</td></tr>`
        : "";

    const rows = entries.map(entry => `<tr class="border-t border-border-subtle first:border-t-0 hover:bg-bg-tertiary">
      <td class="px-4 py-2">${cell(ctx, entry)}</td>
      <td class="px-4 py-2 text-right text-2xs tabular-nums text-text-tertiary">${entry.dir ? "" : size(entry.size)}</td>
      <td class="px-4 py-2 text-right text-2xs whitespace-nowrap text-text-tertiary">${ago(entry.mtime)}</td>
    </tr>`).join("");

    const readme = entries.find(entry => !entry.dir && README.test(entry.name));

    return {
        title: basename(dir) || "/",
        main: `${ctx.fns.filemanager.crumbs({ path: here })}
<div class="mt-4 overflow-hidden rounded-md border border-border-subtle">
  <div class="flex items-center justify-between border-b border-border-subtle bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">
    <span>${entries.length} ${entries.length === 1 ? "item" : "items"}</span>
  </div>
  <table class="w-full text-ui">${up}${rows}</table>
</div>
${readme ? await preview(ctx, readme) : ""}`,
    };
}

function cell(ctx: Context, entry: { name: string; path: string; dir: boolean }): string {
    const href = `/filemanager?path=${encodeURIComponent(entry.path)}`;
    return `<span class="flex items-center gap-2">${ctx.fns.filemanager.icon({ name: entry.name, dir: entry.dir })}
    <a data-entity="file" data-id="${esc(entry.path)}" class="truncate text-text-primary hover:text-text-link hover:underline"
      href="${href}" hx-get="${href}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">${esc(entry.name)}</a></span>`;
}

// GitHub puts the README under the listing, in a box of its own — it is the one
// file a directory is expected to explain itself with.
async function preview(ctx: Context, readme: { name: string; path: string }): Promise<string> {
    const html = await ctx.fns.filemanager.render({ path: readme.path }).catch(() => "");
    if (!html) return "";
    return `<div class="mt-6 overflow-hidden rounded-md border border-border-subtle">
  <div class="flex items-center gap-2 border-b border-border-subtle bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">
    <i class="ph ph-book-open" aria-hidden="true"></i>${esc(readme.name)}
  </div>
  <div class="px-6 py-5">${html}</div>
</div>`;
}

function size(bytes: number): string {
    return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

// "3 days ago" reads faster than a timestamp when you are scanning a list.
function ago(at: Date): string {
    const seconds = Math.round((Date.now() - at.getTime()) / 1000);
    const scale: [number, string][] = [[60, "second"], [60, "minute"], [24, "hour"], [30, "day"], [12, "month"]];
    let value = seconds, unit = "second";
    for (const [step, name] of scale) {
        if (value < step) break;
        value = Math.round(value / step);
        unit = name === "month" ? "year" : next(name);
    }
    return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

function next(unit: string): string {
    return { second: "minute", minute: "hour", hour: "day", day: "month", month: "year" }[unit] ?? unit;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

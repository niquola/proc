// GET /filemanager?path=<rel>&raw=1 — WORKDIR, the way GitHub shows a repo:
// breadcrumbs as the heading, a bordered listing, the README underneath, and a
// file in a box with its own header. `raw=1` serves the bytes.
import { basename, extname, resolve } from "node:path";
import { stat } from "node:fs/promises";

const IMG = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"]);
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".pdf": "application/pdf" };
const TOO_BIG = 3_000_000;

export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const url = new URL(opts.req.url);
    const workdir = ctx.fns.project.workdir({});
    const rel = url.searchParams.get("path") ?? ".";
    const path = resolve(workdir, rel);
    if (path !== workdir && !path.startsWith(workdir + "/")) return { title: "denied", status: 403, main: `outside workdir: ${esc(rel)}` };

    const info = await stat(path).catch(() => null);
    if (!info) return { title: "not found", status: 404, main: `${ctx.fns.filemanager.crumbs({ path: rel })}<div class="mt-4 text-state-danger-fg">Not found: ${esc(rel)}</div>` };

    if (url.searchParams.get("raw")) {
        if (info.isDirectory()) return new Response("is a directory", { status: 400 });
        const ext = extname(path).toLowerCase();
        return new Response(Bun.file(path), { headers: MIME[ext] ? { "Content-Type": MIME[ext] } : {} });
    }

    if (info.isDirectory()) return ctx.fns.filemanager.listing({ dir: path });

    const ext = extname(path).toLowerCase();
    const raw = `/filemanager?path=${encodeURIComponent(rel)}&raw=1`;
    // A plugin may know what this file really is — a Questionnaire is a form,
    // not JSON. Each says so in its manifest ("preview": { files, fn }); the
    // first whose pattern matches renders it, and a plugin that returns null
    // hands the file back to the highlighter.
    const claimed = await ctx.fns.filemanager.claim({ path: rel });
    const body = claimed ? claimed
        : IMG.has(ext)
        ? `<div class="px-6 py-5"><img src="${raw}" class="max-w-full"></div>`
        : info.size > TOO_BIG
            ? `<div class="px-6 py-5 text-text-muted">Too large to show (${size(info.size)}). <a class="text-text-link hover:underline" href="${raw}">Open raw</a></div>`
            : ext === ".md" || ext === ".markdown"
                ? `<div class="px-6 py-5">${await ctx.fns.filemanager.render({ path: rel })}</div>`
                : await ctx.fns.filemanager.render({ path: rel });

    return {
        title: basename(path),
        main: `${ctx.fns.filemanager.crumbs({ path: rel })}
<div class="mt-4 overflow-hidden rounded-md border border-border-subtle">
  <div class="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">
    <span>${size(info.size)}</span>
    <a class="text-text-link hover:underline" href="${raw}" target="_blank" rel="noreferrer">Raw</a>
  </div>
  ${body}
</div>`,
    };
}

function size(bytes: number): string {
    return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

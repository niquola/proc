// GET /filemanager?path=<rel>&raw=1 — browse WORKDIR. Directories list
// GitHub-style; files render as image, markdown or highlighted code.
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { readdir, stat } from "node:fs/promises";
import { marked } from "marked";
import { createHighlighter } from "shiki";

const LANGUAGES = ["javascript", "typescript", "json", "yaml", "bash", "sql", "python", "java", "clojure", "html", "css", "xml", "go", "rust", "c", "cpp", "csharp", "ruby", "php", "dockerfile", "graphql", "diff", "toml", "markdown"] as any[];
const EXT_LANG: Record<string, string> = {
    ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    json: "json", jsonc: "json", yaml: "yaml", yml: "yaml",
    sh: "bash", bash: "bash", zsh: "bash", sql: "sql", py: "python", java: "java",
    clj: "clojure", cljs: "clojure", edn: "clojure",
    html: "html", htm: "html", css: "css", xml: "xml", svg: "xml",
    go: "go", rs: "rust", c: "c", h: "c", cpp: "cpp", hpp: "cpp",
    cs: "csharp", rb: "ruby", php: "php", graphql: "graphql",
    diff: "diff", patch: "diff", toml: "toml", md: "markdown",
};
const IMG = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"]);
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".pdf": "application/pdf" };

const CODE_CSS = `<style>.cv-grid{padding:.6em 0;font-size:12.5px;line-height:1.55;border:1px solid #d0d7de;border-radius:8px;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#fff}.cv-row{display:flex}.cv-row:hover{background:#f6f8fa}.cv-num{flex:0 0 auto;width:3.2em;padding:0 1em 0 0;text-align:right;color:#8c959f;user-select:none}.cv-code{white-space:pre;flex:1}
.prose{line-height:1.6}.prose h1,.prose h2{border-bottom:1px solid #d0d7de;padding-bottom:.3em}.prose h1{font-size:1.8em}.prose h2{font-size:1.4em}.prose h3{font-size:1.15em}.prose p,.prose ul,.prose ol,.prose table{margin:.6em 0}.prose ul{list-style:disc;padding-left:1.4em}.prose ol{list-style:decimal;padding-left:1.4em}.prose :not(pre)>code{background:#eff1f3;border-radius:6px;padding:.15em .4em;font-size:85%}.prose pre.shiki{padding:12px;border-radius:8px;overflow:auto;border:1px solid #d0d7de;font-size:13px;margin:.7em 0}.prose table{border-collapse:collapse}.prose th,.prose td{border:1px solid #d0d7de;padding:6px 12px}.prose blockquote{border-left:4px solid #d0d7de;color:#656d76;padding-left:1em;margin-left:0}.prose a{color:#0969da}</style>`;

export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const url = new URL(opts.req.url);
    const workdir = ctx.fns.project.workdir({});
    const rel = url.searchParams.get("path") ?? ".";
    const path = resolve(workdir, rel);
    if (path !== workdir && !path.startsWith(workdir + "/")) return { title: "denied", status: 403, main: `outside workdir: ${esc(path)}` };
    const ext = extname(path).toLowerCase();

    let info;
    try { info = await stat(path); } catch { return { title: "not found", status: 404, main: `${crumbs(workdir, dirname(path))}<div class="text-red-700">Not found: ${esc(rel)}</div>` }; }

    if (url.searchParams.get("raw")) {
        if (info.isDirectory()) return new Response("is a directory", { status: 400 });
        return new Response(Bun.file(path), { headers: MIME[ext] ? { "Content-Type": MIME[ext] } : {} });
    }

    if (info.isDirectory()) return listing(workdir, path);

    const head = `${crumbs(workdir, path)}<div class="text-xs text-gray-500 mb-3">${fmtSize(info.size)} · ${stamp(info.mtime)} · ${rawLink(workdir, path, "raw")}</div>`;

    if (IMG.has(ext)) {
        return { title: basename(path), main: `${head}<img src="${href(workdir, path)}&raw=1" class="max-w-full border border-gray-200 rounded">` };
    }
    if (info.size > 3_000_000) {
        return { title: basename(path), main: `${head}<div class="text-gray-500">Too large to preview (${fmtSize(info.size)}). ${rawLink(workdir, path, "Open raw")}</div>` };
    }

    const text = await Bun.file(path).text();
    const shiki: any = await (ctx.state.shiki ??= createHighlighter({ themes: ["github-light"], langs: LANGUAGES }));

    if (ext === ".md" || ext === ".markdown") {
        return { title: basename(path), headExtra: CODE_CSS, main: `${head}<div class="prose max-w-3xl">${await marked.parse(text)}</div>` };
    }

    const lang = EXT_LANG[ext.slice(1)] ?? "plaintext";
    let inner: string;
    try {
        const useLang = shiki.getLoadedLanguages().includes(lang) ? lang : "plaintext";
        inner = shiki.codeToHtml(text, { lang: useLang, theme: "github-light" })
            .replace(/^[\s\S]*?<code[^>]*>/, "").replace(/<\/code>\s*<\/pre>\s*$/, "");
    } catch { inner = esc(text); }
    const rows = inner.split("\n").map((line, i) => `<div class="cv-row" id="L${i + 1}"><span class="cv-num">${i + 1}</span><span class="cv-code">${line || " "}</span></div>`).join("");
    return { title: basename(path), headExtra: CODE_CSS, main: `${head}<div class="cv-grid">${rows}</div>` };
}

async function listing(workdir: string, dir: string) {
    const names = await readdir(dir);
    const rows = (await Promise.all(names.sort().map(async name => {
        const info = await stat(join(dir, name)).catch(() => null);
        if (!info) return null;
        return { name, path: join(dir, name), isDir: info.isDirectory(), size: info.size, mtime: info.mtime };
    }))).filter(Boolean) as any[];
    rows.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));

    const body = rows.map(r => `<tr class="border-t border-gray-200 hover:bg-gray-50">
      <td class="px-3 py-1.5">${r.isDir ? "📁" : "📄"} ${link(workdir, r.path, r.name + (r.isDir ? "/" : ""))}</td>
      <td class="px-3 py-1.5 text-xs text-right text-gray-500 tabular-nums">${r.isDir ? "" : fmtSize(r.size)}</td>
      <td class="px-3 py-1.5 text-xs text-gray-500 whitespace-nowrap">${stamp(r.mtime)}</td>
    </tr>`).join("");

    return {
        title: basename(dir) || "/",
        main: `${crumbs(workdir, dir)}<div class="border border-gray-200 rounded-md overflow-hidden"><table class="w-full">
          <thead><tr class="text-left text-xs text-gray-500 bg-gray-50"><th class="px-3 py-2 font-medium">${rows.length} items</th><th class="px-3 py-2 font-medium text-right">Size</th><th class="px-3 py-2 font-medium">Modified</th></tr></thead>
          <tbody>${dir === workdir ? "" : `<tr class="border-t border-gray-200"><td class="px-3 py-1.5" colspan="3">📁 ${link(workdir, dirname(dir), "..")}</td></tr>`}${body}</tbody></table></div>`,
    };
}

function crumbs(workdir: string, path: string): string {
    const parts = relative(workdir, path).split("/").filter(p => p && p !== ".");
    let acc = workdir;
    const segs = parts.map(seg => { acc = join(acc, seg); return link(workdir, acc, seg); });
    return `<div class="mb-4 text-gray-500">${link(workdir, workdir, basename(workdir))}${segs.map(s => `<span class="text-gray-400"> / </span>${s}`).join("")}</div>`;
}

function href(workdir: string, path: string): string {
    return `/filemanager?path=${encodeURIComponent(relative(workdir, path) || ".")}`;
}

function link(workdir: string, path: string, label: string): string {
    return `<a data-entity="file" data-id="${esc(relative(workdir, path) || ".")}" class="text-blue-700 hover:underline" href="${href(workdir, path)}">${esc(label)}</a>`;
}

function rawLink(workdir: string, path: string, label: string): string {
    return `<a class="text-blue-700 hover:underline" href="${href(workdir, path)}&raw=1">${esc(label)}</a>`;
}

function fmtSize(n: number): string {
    return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

function stamp(d: Date): string {
    return d.toISOString().slice(0, 16).replace("T", " ");
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

// One file as html: markdown through marked, an image as itself, anything else
// through shiki with a line gutter. Raw html in markdown is escaped — a file in
// the workdir is data, and this page is served on the same origin as the REPL.
import { extname } from "node:path";
import { Marked } from "marked";
import { createHighlighter } from "shiki";

const LANGUAGES = ["javascript", "typescript", "json", "yaml", "bash", "sql", "python", "java", "clojure", "html", "css", "xml", "go", "rust", "c", "cpp", "csharp", "ruby", "php", "dockerfile", "graphql", "diff", "toml", "markdown"] as any[];
const EXT_LANG: Record<string, string> = {
    ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    json: "json", jsonc: "json", yaml: "yaml", yml: "yaml",
    sh: "bash", bash: "bash", zsh: "bash", sql: "sql", py: "python", java: "java",
    clj: "clojure", cljs: "clojure", edn: "clojure", html: "html", htm: "html",
    css: "css", xml: "xml", svg: "xml", go: "go", rs: "rust", c: "c", h: "c",
    cpp: "cpp", hpp: "cpp", cs: "csharp", rb: "ruby", php: "php",
    graphql: "graphql", diff: "diff", patch: "diff", toml: "toml", md: "markdown",
};

export default async function (ctx: Context, _session: Session | null, opts: { path: string }): Promise<string> {
    const file = `${ctx.fns.project.workdir({})}/${opts.path}`;
    const ext = extname(file).toLowerCase();
    const text = await Bun.file(file).text();

    if (ext === ".md" || ext === ".markdown") {
        return `<div class="md-preview">${markdown().parse(text, { async: false }) as string}</div>`;
    }

    const shiki: any = await (ctx.state.shiki ??= createHighlighter({ themes: ["github-light"], langs: LANGUAGES }));
    const lang = EXT_LANG[ext.slice(1)] ?? "plaintext";
    let inner: string;
    try {
        const useLang = shiki.getLoadedLanguages().includes(lang) ? lang : "plaintext";
        inner = shiki.codeToHtml(text, { lang: useLang, theme: "github-light" })
            .replace(/^[\s\S]*?<code[^>]*>/, "").replace(/<\/code>\s*<\/pre>\s*$/, "");
    } catch { inner = esc(text); }

    // `whitespace-pre` is the whole point: stripping shiki's <pre> took the
    // preserved indentation with it. The gutter is sticky so the numbers stay
    // put while a long line scrolls the box sideways.
    const lines = inner.split("\n").map((line, i) =>
        `<div class="flex" id="L${i + 1}"><span class="sticky left-0 w-12 shrink-0 select-none bg-bg-content pr-4 text-right text-text-muted">${i + 1}</span><span class="whitespace-pre">${line || " "}</span></div>`).join("");
    return `<div class="overflow-x-auto py-2 font-mono text-xs leading-5">${lines}</div>`;
}

let marked: any;
function markdown(): any {
    marked ??= new Marked({ gfm: true }).use({ renderer: { html: (token: any) => esc(token.raw ?? token.text ?? "") } });
    return marked;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

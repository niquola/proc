// Agent text → html. `marked` always; shiki only once the turn has stopped
// streaming — while `agent.status === "running"` the whole fragment is
// re-rendered on every chunk, and highlighting each one is the wrong cost.
// The next render after the turn ends upgrades every block in place.
//
// Fenced blocks are pulled out of marked's output, highlighted, and put back:
// a ```ts#src/a.ts info string renders a file header welded onto the top of the
// <pre>, the same way wmlet's preview pipeline does. Mermaid is not ported.
import { Marked } from "marked";
import { createHighlighter } from "shiki";

const THEME = "github-light";

const LANGS = [
    "javascript", "typescript", "tsx", "jsx", "json", "css", "scss", "html", "sql",
    "python", "markdown", "xml", "rust", "java", "cpp", "c", "go", "php", "yaml",
    "ruby", "bash", "shell", "dockerfile", "toml", "diff", "clojure", "graphql", "http",
] as any[];

const ALIASES: Record<string, string> = {
    js: "javascript", ts: "typescript", sh: "bash", zsh: "bash", yml: "yaml",
    py: "python", rb: "ruby", cs: "csharp", "c++": "cpp", "c#": "csharp",
    txt: "text", plain: "text", clj: "clojure", gql: "graphql",
};

const CODE_BLOCK = /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g;

export default function (ctx: Context, _session: Session | null, opts: { text?: unknown }): string {
    // The agent quotes whatever it read — a README, a fetched page, a tool
    // result. marked ships no sanitizer since v5, and this html is injected raw
    // into the tab that holds the page.eval bridge, so raw html tokens are
    // escaped back into text. Fenced code is a `code` token and unaffected.
    const html = renderer().parse(String(opts.text ?? ""), { async: false }) as string;
    const shiki = ctx.state.agent?.status === "running" ? null : highlighter(ctx);

    const blocks: { placeholder: string; lang: string; raw: string; header: string; preStyle: string }[] = [];
    let out = html.replace(CODE_BLOCK, (_match, info: string, escaped: string) => {
        const hash = info.indexOf("#");
        const filename = hash >= 0 ? info.slice(hash + 1) : "";
        const placeholder = `<!--CODE_${blocks.length}-->`;
        blocks.push({
            placeholder,
            lang: normalizeLang(info),
            raw: decode(escaped),
            header: filename ? codeHeader(ctx, filename) : "",
            preStyle: filename ? "border-radius:0 0 var(--radius-sm, 4px) var(--radius-sm, 4px);margin-top:0" : "",
        });
        return placeholder;
    });

    for (const block of blocks) {
        const loaded = shiki && (shiki.getLoadedLanguages() as string[]).includes(block.lang);
        const code = loaded
            ? highlighted(shiki.codeToHtml(block.raw, { lang: block.lang, theme: THEME }), block.preStyle)
            : `<pre class="shiki github-light"${block.preStyle ? ` style="${block.preStyle}"` : ""}><code>${ctx.fns.chat.escape({ text: block.raw })}</code></pre>`;
        out = out.replace(block.placeholder, () => block.header + code);
    }
    return out;
}

// The highlighter is built once per process and cached on ctx.state. Building it
// is async and this render path is not, so the very first block renders plain —
// the chat re-renders on the next agent event, by which time it is ready.
function highlighter(ctx: Context): any {
    const slot = (ctx.state.chatShiki ??= {});
    slot.building ??= createHighlighter({ themes: [THEME], langs: LANGS })
        .then((h: any) => { slot.shiki = h; })
        // Nothing awaits this, so an unhandled rejection would kill the process;
        // dropping the slot also lets the next render try again.
        .catch((error: any) => {
            ctx.fns.log.warn({ event: "chat.shiki.failed", msg: String(error?.message ?? error) });
            delete slot.building;
        });
    return slot.shiki ?? null;
}

function normalizeLang(info: string): string {
    const lang = (info.split(/[#\s]/)[0] ?? "").toLowerCase().trim();
    return ALIASES[lang] ?? lang;
}

function highlighted(code: string, preStyle: string): string {
    return preStyle ? code.replace("<pre ", `<pre style="${preStyle}" `) : code;
}

function codeHeader(ctx: Context, filename: string): string {
    const label = ctx.fns.chat.escape({ text: filename });
    return `<div style="display:flex;align-items:center;gap:6px;padding:4px 12px;background:var(--color-bg-tertiary);border:1px solid var(--color-border-subtle, #e7e5e4);border-bottom:none;border-radius:4px 4px 0 0;font-size:12px;font-family:system-ui,sans-serif;margin:0"><a href="/filemanager?path=${encodeURIComponent(filename)}" style="display:flex;align-items:center;gap:6px;color:var(--color-text-link, #3461a8);text-decoration:none" title="Open ${label}"><i class="ph ph-folder text-sm text-text-placeholder shrink-0" aria-hidden="true"></i><span>${label}</span></a></div>`;
}

// marked escapes the fence body; shiki wants the source back.
function decode(escaped: string): string {
    return escaped
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, "&");
}

// One marked instance per process, with raw html turned back into text. `use`
// merges over the default renderer — passing `renderer` to `parse` would replace
// it wholesale and break every other token.
let marked: any;
function renderer(): any {
    marked ??= new Marked({ gfm: true }).use({
        renderer: { html: (token: any) => escapeHtml(token.raw ?? token.text ?? "") },
    });
    return marked;
}

// marked hands raw html through untouched; this is the only place that decides
// it is text, so it lives here rather than in ctx.fns.chat.escape.
function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

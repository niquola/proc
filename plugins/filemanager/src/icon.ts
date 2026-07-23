// One phosphor icon per entry, GitHub's palette: folders blue, code files plain,
// the few kinds worth recognising recognisable.
const BY_EXT: Record<string, string> = {
    md: "ph-file-text", markdown: "ph-file-text", txt: "ph-file-text",
    json: "ph-brackets-curly", jsonc: "ph-brackets-curly", yaml: "ph-brackets-curly", yml: "ph-brackets-curly", toml: "ph-brackets-curly",
    ts: "ph-file-ts", tsx: "ph-file-ts", js: "ph-file-js", jsx: "ph-file-js", mjs: "ph-file-js", cjs: "ph-file-js",
    css: "ph-file-css", html: "ph-file-html", sql: "ph-database",
    png: "ph-file-image", jpg: "ph-file-image", jpeg: "ph-file-image", gif: "ph-file-image", svg: "ph-file-image", webp: "ph-file-image",
    sh: "ph-terminal-window", bash: "ph-terminal-window", zsh: "ph-terminal-window",
    lock: "ph-lock-simple", gitignore: "ph-git-branch",
};

export default function (_ctx: Context, _session: Session | null, opts: { name: string; dir: boolean }): string {
    if (opts.dir) return `<i class="ph ph-folder-simple text-base text-[#54aeff]" aria-hidden="true"></i>`;
    const ext = opts.name.includes(".") ? opts.name.split(".").pop()!.toLowerCase() : "";
    return `<i class="ph ${BY_EXT[ext] ?? "ph-file"} text-base text-text-tertiary" aria-hidden="true"></i>`;
}

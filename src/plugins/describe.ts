// How a plugin presents itself: the tab's label and icon, and the one sentence
// the manager and the agent's index show. The sentence falls back to the
// `description:` a SKILL.md already carries in its frontmatter, so a plugin that
// is also a skill writes it once.
export default async function (_ctx: Context, _session: Session | null, opts: { dir: string; namespace: string; manifest: any }): Promise<{ label: string; icon: string; description: string; skill: string | null; preview: { files: string; fn: string } | null }> {
    const skill = `${opts.dir}/SKILL.md`;
    const head = await Bun.file(skill).text().then(text => text.slice(0, 800)).catch(() => null);
    return {
        label: opts.manifest.label ?? opts.namespace.slice(0, 1).toUpperCase() + opts.namespace.slice(1),
        icon: opts.manifest.icon ?? "ph-squares-four",
        description: opts.manifest.description ?? head?.match(/^description:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "",
        skill: head === null ? null : skill,
        // "preview": { "files": "$qr_*.json", "fn": "preview" } — which files this
        // plugin renders itself, and what to call with { path }.
        preview: opts.manifest.preview?.files && opts.manifest.preview?.fn ? opts.manifest.preview : null,
    };
}

// What kind of tool a message is, and how to label it. Both the collapsed pill
// and the expanded row need this, and when each kept its own table they drifted:
// adding a kind to one silently left the other on the wrench icon.
//
// The ACP `kind` decides it; a Codex-style title is the only fallback, since
// procs does not persist wmlet's `_meta.claudeCode.toolName`.
const META: Record<string, { icon: string; label: string }> = {
    read: { icon: "ph-file-text", label: "Read" },
    edit: { icon: "ph-pencil-simple", label: "Edit" },
    delete: { icon: "ph-trash", label: "Delete" },
    move: { icon: "ph-arrows-left-right", label: "Move" },
    search: { icon: "ph-magnifying-glass", label: "Search" },
    execute: { icon: "ph-terminal-window", label: "Execute" },
    think: { icon: "ph-brain", label: "Think" },
    fetch: { icon: "ph-download-simple", label: "Fetch" },
    switch_mode: { icon: "ph-swap", label: "Switch mode" },
    other: { icon: "ph-wrench", label: "Tool" },
};

export default function (_ctx: Context, _session: Session | null, opts: { message: types.agent.Message }): { kind: string; icon: string; label: string } {
    const declared = String(opts.message.data?.kind ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_");
    const title = opts.message.title?.trim();
    const kind = declared && declared !== "other" && META[declared]
        ? declared
        : title === "exec_command" || title === "write_stdin" ? "execute" : "other";
    return { kind, ...META[kind]! };
}

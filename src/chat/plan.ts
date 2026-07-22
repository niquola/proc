// The todo block of one `kind:"plan"` message — the ACP plan entries as a
// card of checkbox rows. Three states per entry: completed (checked, muted),
// in_progress (spinner), everything else (empty square, placeholder tone).
export default function (ctx: Context, _session: Session | null, opts: { entries?: any[] | null }): string {
    const list = Array.isArray(opts.entries) ? opts.entries : [];
    const icon = (status?: string) =>
        status === "completed" ? "ph ph-check-square text-text-muted"
            : status === "in_progress" ? "ph ph-spinner animate-spin text-text-tertiary"
                : "ph ph-square text-text-placeholder";
    const tone = (status?: string) => status === "completed" ? "text-text-muted" : "text-text-primary";
    const row = (entry: any) => `<div class="flex items-start gap-2 py-1">
      <i class="mt-0.5 w-4 shrink-0 text-ui ${icon(entry?.status)}" aria-hidden="true"></i>
      <div class="min-w-0 flex-1 text-sm leading-snug ${tone(entry?.status)}">${ctx.fns.chat.escape({ text: entry?.content || "Untitled task" })}</div>
    </div>`;
    return `<div class="max-w-3xl my-1.5 rounded-md border border-border-subtle bg-bg-tertiary px-3 py-2">
  <div>
${list.length === 0 ? `    <div class="text-xs text-text-placeholder">No todo items.</div>` : list.map(row).join("\n")}
  </div>
</div>`;
}

// The rows, or the reason there are none. Shared by the inspector and the file
// preview so a view looks the same wherever you meet it.
export default function (_ctx: Context, _session: Session | null, opts: { columns: Array<{ name: string }>; rows: any[]; error: string | null; table: string }): string {
    if (opts.error) {
        return `<div class="rounded-md border border-state-warning-border bg-state-warning-bg px-4 py-2 text-2xs text-state-warning-fg">
  <span class="font-mono">${esc(opts.table)}</span> is not readable yet — materialize it. <span class="opacity-70">${esc(opts.error)}</span>
</div>`;
    }
    if (!opts.rows.length) return `<div class="text-2xs text-text-tertiary"><span class="font-mono">${esc(opts.table)}</span> is empty — no resource matched.</div>`;

    const names = opts.columns.length ? opts.columns.map(c => c.name) : Object.keys(opts.rows[0]);
    return `<div class="overflow-x-auto rounded-md border border-border-subtle">
  <table class="w-full text-2xs">
    <thead><tr class="bg-bg-tertiary text-left text-text-tertiary">${names.map(n => `<th class="px-3 py-1.5 font-medium">${esc(n)}</th>`).join("")}</tr></thead>
    <tbody>${opts.rows.map(row => `<tr class="border-t border-border-subtle">${names.map(n => `<td class="px-3 py-1.5 font-mono">${esc(cell(row[n]))}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>
</div>`;
}

function cell(value: any): string {
    return value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

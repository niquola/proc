// The list as an htmx fragment (swapped into #list on every add/toggle/delete).
export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    const items = ctx.fns.todo.list({});
    const rows = items.map((t: any) => `
    <li class="flex items-center gap-3 py-2 border-b border-gray-100">
      <input type="checkbox" ${t.done ? "checked" : ""} class="size-4 accent-blue-600"
        hx-post="/todo/${t.id}/toggle" hx-target="#list" hx-swap="innerHTML">
      <span class="flex-1 ${t.done ? "line-through text-gray-400" : ""}">${esc(t.title)}</span>
      <button class="text-gray-300 hover:text-red-600 px-1 text-lg leading-none"
        hx-post="/todo/${t.id}/delete" hx-target="#list" hx-swap="innerHTML" title="delete">×</button>
    </li>`).join("");
    const left = items.filter((t: any) => !t.done).length;
    return `<ul>${rows || `<li class="py-3 text-gray-400">no todos yet</li>`}</ul>
    <div class="text-xs text-gray-400 mt-3">${items.length} total · ${left} left</div>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

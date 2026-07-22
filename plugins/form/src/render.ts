// The form as HTML — plain inputs, posted back to the workspace.
export default function (ctx: Context, _session: Session | null, opts: { id: string }): string {
    const form = ctx.state.forms?.[opts.id];
    if (!form) return `<div class="text-red-700">no such form: ${esc(opts.id)}</div>`;
    if (form.answer) {
        return `<h1 class="text-lg font-semibold mb-3">${esc(form.title)}</h1>
<div class="rounded border border-gray-200 p-4">
  <div class="text-xs uppercase tracking-wide text-gray-400 mb-2">submitted</div>
  <table>${Object.entries(form.answer).map(([k, v]) =>
            `<tr><td class="pr-4 text-gray-500">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
</div>`;
    }
    return `<h1 class="text-lg font-semibold mb-3">${esc(form.title)}</h1>
<form data-form="${esc(form.id)}" class="max-w-lg space-y-4" hx-post="/form/${esc(form.id)}" hx-target="#main" hx-swap="innerHTML">
${form.fields.map(field).join("")}
  <button data-action="submit" class="rounded bg-gray-900 text-white px-4 py-2">Submit</button>
</form>`;
}

function field(f: types.form.Field): string {
    const label = `<label class="block text-sm font-medium mb-1" for="${esc(f.name)}">${esc(f.label ?? f.name)}</label>`;
    const base = `id="${esc(f.name)}" name="${esc(f.name)}" ${f.required ? "required" : ""} class="w-full rounded border border-gray-300 px-3 py-2"`;
    const input = f.type === "textarea" ? `<textarea ${base} rows="4">${esc(f.value ?? "")}</textarea>`
        : f.type === "select" ? `<select ${base}>${(f.options ?? []).map(o => `<option ${o === f.value ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`
            : f.type === "checkbox" ? `<input type="checkbox" id="${esc(f.name)}" name="${esc(f.name)}" value="yes" ${f.value ? "checked" : ""}>`
                : `<input type="${esc(f.type ?? "text")}" ${base} value="${esc(f.value ?? "")}">`;
    return `<div>${label}${input}</div>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

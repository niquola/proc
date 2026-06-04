// Minimal HTML shell. Route handlers return a string (or { main, title }) and
// http/$start.ts wraps it with this layout automatically.
export default function (ctx: Context, opts: { title?: string; main: string; headExtra?: string }, _req?: Request) {
    const pageTitle = opts.title ? `${opts.title} · procs` : "procs";
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(pageTitle)}</title>
<script src="https://cdn.tailwindcss.com?plugins=typography"></script>
<script src="https://unpkg.com/htmx.org@2.0.4" defer></script>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
</style>
${opts.headExtra ?? ""}
<script src="/events/client.js" defer></script>
</head>
<body class="bg-white text-gray-900 text-sm min-h-screen">
<main class="max-w-4xl mx-auto p-6">${opts.main}</main>
</body>
</html>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

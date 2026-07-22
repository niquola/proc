// GET /processes — what the workspace supervises, with the tail of its output.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const selected = new URL(opts.req.url).searchParams.get("name") ?? "app";
    const services = ctx.fns.services.status({});
    const logs = ctx.fns.services.logs({ name: selected, lines: 200 });

    const rows = services.map(s => `<tr data-entity="service" data-id="${esc(s.name)}" class="border-t border-gray-200">
  <td class="px-3 py-1.5"><a class="text-blue-700 hover:underline" href="/processes?name=${encodeURIComponent(s.name)}">${esc(s.name)}</a></td>
  <td class="px-3 py-1.5">${s.running ? `<span class="text-green-700">running</span>` : `<span class="text-red-700">exited ${s.exitCode}</span>`}</td>
  <td class="px-3 py-1.5"><a class="text-blue-700 hover:underline" href="http://localhost:${s.port}" target="_blank">:${s.port}</a></td>
  <td class="px-3 py-1.5 font-mono text-xs text-gray-500">${s.pid}</td>
  <td class="px-3 py-1.5 font-mono text-xs text-gray-500">${esc(s.cmd.join(" "))}</td>
  <td class="px-3 py-1.5 font-mono text-xs text-gray-500">${Object.entries(s.env).map(([k, v]) => `${esc(k)}=${esc(v)}`).join("<br>")}</td>
  <td class="px-3 py-1.5 text-xs text-gray-500">${esc(s.startedAt.slice(0, 19).replace("T", " "))}</td>
  <td class="px-3 py-1.5 text-right">
    <form method="post" action="/processes/${encodeURIComponent(s.name)}/restart" class="inline"><button data-action="restart" class="text-blue-700 hover:underline">restart</button></form>
    <form method="post" action="/processes/${encodeURIComponent(s.name)}/stop" class="inline ml-3"><button data-action="stop" class="text-red-700 hover:underline">stop</button></form>
  </td>
</tr>`).join("");

    return {
        title: "processes",
        main: `<div class="border border-gray-200 rounded-md overflow-hidden mb-6"><table class="w-full">
  <thead><tr class="text-left text-xs text-gray-500 bg-gray-50">
    <th class="px-3 py-2 font-medium">${services.length} services</th><th class="px-3 py-2 font-medium">Status</th><th class="px-3 py-2 font-medium">Port</th>
    <th class="px-3 py-2 font-medium">PID</th><th class="px-3 py-2 font-medium">Command</th><th class="px-3 py-2 font-medium">Env</th><th class="px-3 py-2 font-medium">Started</th><th></th>
  </tr></thead>
  <tbody>${rows || `<tr><td class="px-3 py-2 text-gray-500" colspan="8">nothing running</td></tr>`}</tbody>
</table></div>
<h2 class="font-semibold mb-2">${esc(selected)} logs</h2>
<pre class="border border-gray-200 rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">${esc(logs.join("\n")) || "<span class=\"text-gray-400\">no output</span>"}</pre>`,
    };
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

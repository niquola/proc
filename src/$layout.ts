// Minimal HTML shell: agent chat on the left, and a right column whose own
// header lists the mounted plugins above the page. Route handlers return a
// string (or { main, title }) and http/$start.ts wraps it automatically.
export default function (ctx: Context, session: Session | null, opts: { title?: string; main: string; headExtra?: string }) {
    const pageTitle = opts.title ? `${opts.title} · procs` : "procs";
    const plugins: string[] = ctx.state.plugins ?? [];
    const path = session?.url?.pathname ?? "/";
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
<script>
  // The server emits {type:"agent"} on every session update; refetch the
  // transcript and keep it pinned to the bottom.
  // The workspace injects JS by pushing {type:"eval"} down the event stream;
  // the tab runs it and posts the result back.
  document.addEventListener("hyper-events", async e => {
    if (e.detail?.type === "eval") {
      const { id, code } = e.detail;
      let body;
      try {
        const value = await new Function("return (async () => { " + code + " })()")();
        body = { id, value: value === undefined ? null : value };
      } catch (err) {
        body = { id, error: String(err) };
      }
      fetch("/page/result", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      return;
    }
    if (e.detail?.type !== "agent") return;
    fetch("/agent/chat").then(r => r.text()).then(html => {
      const chat = document.getElementById("chat");
      if (!chat) return;
      chat.outerHTML = html;
      const fresh = document.getElementById("chat");
      if (fresh) fresh.scrollTop = fresh.scrollHeight;
    });
  });
</script>
</head>
<body class="bg-white text-gray-900 text-sm h-screen flex">
<aside class="w-96 shrink-0 border-r border-gray-200 flex flex-col">
  <header class="h-12 shrink-0 border-b border-gray-200 flex items-center px-4">
    <a class="font-semibold" href="/">procs</a>
  </header>
  ${ctx.fns.agent.chat({})}
  <form data-form="chat" class="shrink-0 border-t border-gray-200 p-3 flex gap-2"
        hx-post="/agent/prompt" hx-target="#chat" hx-swap="outerHTML" hx-on::after-request="this.reset()">
    <input name="text" autocomplete="off" class="flex-1 rounded border border-gray-300 px-3 py-2" placeholder="Ask anything">
    <button data-action="send" class="rounded bg-gray-900 text-white px-3 py-2">Send</button>
  </form>
</aside>
<section class="flex-1 min-w-0 flex flex-col" hx-boost="true" hx-target="#main" hx-swap="innerHTML">
  ${ctx.fns.ui.tabs({ path })}
  <main id="main" class="flex-1 min-h-0 overflow-y-auto p-6">${opts.main}</main>
</section>
</body>
</html>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

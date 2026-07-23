// The way in when there is no link to click: paste the token the workspace
// printed. It is the same token the magic link carries, so there is one thing
// to lose and one thing to check.
export default function (ctx: Context, _session: Session | null, opts: { next?: string; error?: string }): string {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Sign in · procs</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }</style>
</head>
<body class="flex min-h-screen items-center justify-center bg-[#fafaf9] text-[#1c1917]">
<form method="post" action="/auth/login" class="w-[26rem] rounded-lg border border-[#e7e5e4] bg-white p-6" data-form="login">
  <h1 class="text-lg font-semibold">procs</h1>
  <p class="mt-1 text-xs text-[#78716c]">This workspace asks who you are. Paste the token it printed when it started — or open the link from the same line.</p>
  ${opts.error ? `<div class="mt-4 rounded-md border border-[#f2cec9] bg-[#fdf2f1] px-3 py-2 text-xs text-[#8f2f22]" data-role="error">${esc(opts.error)}</div>` : ""}
  <input type="hidden" name="next" value="${esc(opts.next ?? "/")}">
  <textarea name="token" data-field="token" rows="5" placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9…"
    class="mt-4 w-full rounded-md border border-[#e7e5e4] p-3 font-mono text-xs outline-none focus:border-[#b8c6dc]"></textarea>
  <button data-action="sign-in" class="mt-3 w-full rounded-md bg-[#3461a8] px-3 py-2 text-sm text-white hover:bg-[#284e8b]">Sign in</button>
</form>
</body>
</html>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

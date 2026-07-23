// Minimal HTML shell: agent chat on the left, and a right column whose own
// header lists the mounted plugins above the page. Route handlers return a
// string (or { main, title }) and http/$start.ts wraps it automatically.
//
// The head carries the chat's three dependencies: the Phosphor icon webfont
// (every `<i class="ph ph-*">` in src/chat/ resolves through it), the design
// tokens the ported markup names (`bg-bg-content`, `text-text-muted`, `text-ui`,
// …) taught to the Tailwind CDN, and the handful of component classes those
// fragments reuse (`ui-compose-box`, `md-preview`, …).
export default function (ctx: Context, session: Session | null, opts: { title?: string; main: string; headExtra?: string }) {
    const pageTitle = opts.title ? `${opts.title} · procs` : "procs";
    const path = session?.url?.pathname ?? "/";
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(pageTitle)}</title>
<script src="https://cdn.tailwindcss.com?plugins=typography"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          "bg-primary": "#fafaf9", "bg-tertiary": "#f5f5f4", "bg-quaternary": "#f0efec",
          "bg-tint-hover": "#ebebe8", "bg-content": "#ffffff", "bg-selected": "#eef3fa",
          "border-separator": "#e7e5e4", "border-input": "#e7e5e4", "border-focus": "#b8c6dc", "border-subtle": "#e7e5e4",
          "text-primary": "#1c1917", "text-heading": "#1c1917", "text-muted": "#57534e",
          "text-tertiary": "#78716c", "text-placeholder": "#a8a29e", "text-inverse": "#ffffff", "text-link": "#3461a8",
          brand: "#3461a8", "brand-hover": "#284e8b", "brand-disabled": "rgba(52, 97, 168, 0.5)",
          "accent-soft": "rgba(52, 97, 168, 0.08)", "focus-ring": "#b8c6dc",
          "status-running": "#4b9a68", "status-warning": "#b7791f", "status-error": "#cd3131",
          "state-info-bg": "#f2f6fc", "state-info-border": "#cfdcf0", "state-info-fg": "#274b83",
          "state-success-bg": "#eff8f2", "state-success-border": "#c6e6d1", "state-success-fg": "#2f6142",
          "state-warning-bg": "#fdf4e3", "state-warning-border": "#efdcb0", "state-warning-fg": "#7a5216",
          "state-danger-bg": "#fdf2f1", "state-danger-border": "#f2cec9", "state-danger-fg": "#8f2f22",
          "state-neutral-bg": "#f6f6f7", "state-neutral-border": "#e2e2e5", "state-neutral-fg": "#6c6c72"
        },
        fontSize: {
          micro: ["0.5625rem", "0.75rem"], "3xs": ["0.625rem", "0.875rem"], "2xs": ["0.6875rem", "1rem"],
          ui: ["0.8125rem", "1.25rem"], "ui-lg": ["0.9375rem", "1.5rem"], title: ["1.375rem", "1.75rem"]
        },
        borderRadius: { sm: "4px", md: "6px", lg: "8px", xl: "10px", "2xl": "12px" },
        boxShadow: {
          popover: "0 2px 10px rgba(0, 0, 0, 0.08)",
          xs: "0 1px 2px rgba(28, 25, 23, 0.04)",
          md: "0 1px 2px rgba(28, 25, 23, 0.03), 0 12px 28px -16px rgba(28, 25, 23, 0.1)",
          lg: "0 1px 2px rgba(28, 25, 23, 0.03), 0 14px 24px -14px rgba(28, 25, 23, 0.16)",
          accent: "0 2px 6px -1px rgba(52, 97, 168, 0.4)"
        },
        letterSpacing: { eyebrow: "0.22em", label: "0.04em" }
      }
    }
  };
</script>
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
<script src="https://unpkg.com/htmx.org@2.0.4" defer></script>
<style>
  :root {
    --color-bg-content: #ffffff;
    --color-bg-tertiary: #f5f5f4;
    --color-border-input: #e7e5e4;
    --color-border-focus: #b8c6dc;
    --color-brand: #3461a8;
    --color-brand-hover: #284e8b;
    --color-brand-disabled: rgba(52, 97, 168, 0.5);
    --color-accent-soft: rgba(52, 97, 168, 0.08);
  }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }

  /* the chat's compose box: one focus ring around textarea + control row */
  .ui-compose-box {
    background: var(--color-bg-content);
    border: 1px solid var(--color-border-input);
    border-radius: 8px;
    transition: border-color 0.22s, box-shadow 0.22s;
  }
  .ui-compose-box:focus-within {
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 4px var(--color-accent-soft);
  }
  .ui-btn-send {
    width: 36px; height: 36px; border-radius: 9999px;
    background: var(--color-brand); border: 0; color: #ffffff; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 2px 6px -1px rgba(52, 97, 168, 0.4);
    flex-shrink: 0;
  }
  .ui-btn-send:hover:not(:disabled) {
    background: var(--color-brand-hover); transform: translateY(-1px);
    box-shadow: 0 4px 10px -2px rgba(52, 97, 168, 0.4);
  }
  .ui-btn-send:disabled { background: var(--color-brand-disabled); box-shadow: none; cursor: not-allowed; }
  .ui-btn-send svg { width: 14px; height: 14px; stroke: #ffffff; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; fill: none; }
  .ui-overlay-shadow { box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08); z-index: 600; }

  /* the tool pill's panel: a top-layer popover anchored under its own trigger */
  .tool-actions-tooltip {
    position: fixed; left: anchor(left); top: anchor(bottom); right: auto; bottom: auto;
    margin: 0.375rem 0 0; z-index: 50; overflow: visible;
    width: min(28rem, calc(100vw - 2rem)); max-width: calc(100vw - 2rem); max-height: calc(100dvh - 2rem);
    position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
  }
  .tool-actions-tooltip.tool-actions-tooltip-large {
    top: 1rem; height: calc(100dvh - 2rem); width: min(42rem, calc(100vw - 2rem));
    position-try-fallbacks: flip-inline;
  }
  .tool-actions-scroll { max-height: inherit; }

  /* the chat's disclosure rows: tool calls, thinking, "show full <section>" */
  details > summary { list-style: none; }
  details > summary::-webkit-details-marker { display: none; }
  .tool-output-full[open] + .tool-output-preview { display: none; }
  .tool-actions-anchor:focus-visible { outline: 2px solid #3461a8; outline-offset: 2px; }
  .tool-icon-running { border-color: #57534e; color: #1c1917; animation: tool-icon-pulse 1.6s cubic-bezier(0.2, 0.7, 0.2, 1) infinite; }
  @keyframes tool-icon-pulse {
    0% { box-shadow: 0 0 0 0 rgba(28, 25, 23, 0.28); }
    70% { box-shadow: 0 0 0 5px rgba(28, 25, 23, 0); }
    100% { box-shadow: 0 0 0 0 rgba(28, 25, 23, 0); }
  }
  @media (prefers-reduced-motion: reduce) { .tool-icon-running { animation: none; } }
  .ui-panel-bar {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 0 16px; height: 52px; flex-shrink: 0;
    background: var(--color-bg-tertiary); border-bottom: 1px solid #e7e5e4;
  }
  .ui-pane-header { flex-shrink: 0; border-bottom: 1px solid #e7e5e4; background: var(--color-bg-tertiary); display: flex; align-items: center; min-height: 52px; }

  /* rendered agent markdown */
  .md-preview pre { padding: 0.5rem 0.75rem; border-radius: 0.25rem; overflow-x: auto; margin: 1rem 0; background: var(--color-bg-tertiary); color: #1c1917; }
  .md-preview div + pre { margin-top: 0; }
  .md-preview pre code { font-size: 0.8125rem; background: transparent; padding: 0; }
  .md-preview :not(pre) > code { font-size: 0.8125rem; font-weight: 500; background: var(--color-bg-tertiary); padding: 0.125rem 0.375rem; border-radius: 0.25rem; color: #1c1917; }
  .md-preview code::before, .md-preview code::after { content: none; }
  .md-preview blockquote { border-left: 4px solid rgba(52, 97, 168, 0.3); background: rgba(52, 97, 168, 0.05); border-radius: 0 0.25rem 0.25rem 0; padding: 0.5rem 1rem; font-style: normal; }
  .md-preview h1 { padding-bottom: 0.5rem; border-bottom: 1px solid #e7e5e4; }
  .md-preview a { color: #3461a8; text-decoration: none; }
  .md-preview a:hover { text-decoration: underline; }
  .md-preview img { border-radius: 0.25rem; }
  .md-preview table { border-collapse: collapse; }
  .md-preview th { background: var(--color-bg-tertiary); }
  .md-preview td, .md-preview th { border: 1px solid #e7e5e4; padding: 0.375rem 0.75rem; font-size: 0.8125rem; }
</style>
${opts.headExtra ?? ""}
<script src="/events/client.js" defer></script>
<script src="/chat/client.js" defer></script>
<script>
  // htmx fires htmx:load on the nodes it swaps in, and once on <body> at boot —
  // never on their descendants. Every hx-on--load in src/chat/ sits on such a
  // descendant (the composer form and both menus at boot, the menus again after
  // each out-of-band swap of #chat-controls), so hand the event down to them.
  // The synthetic event does not bubble, so this never re-enters itself.
  document.addEventListener("htmx:load", e => {
    for (const el of e.target.querySelectorAll?.("[hx-on--load]") ?? []) el.dispatchEvent(new CustomEvent("htmx:load"));
  });

  // The server emits {type:"agent"} on every session update; refetch the chat
  // and let htmx do the swap, so hx-on--load wiring runs and the response's
  // hx-swap-oob islands (queue, controls, send) land in the same pass.
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
    const html = await fetch("/chat").then(r => r.text());
    if (!document.getElementById("chat")) return;
    htmx.swap("#chat", html, { swapStyle: "outerHTML" });
  });
</script>
</head>
<body class="bg-bg-primary text-text-primary text-sm h-screen flex">
<aside class="w-96 shrink-0 border-r border-border-separator flex flex-col bg-bg-content">
  <header class="h-12 shrink-0 border-b border-border-separator flex items-center px-4">
    <a class="font-semibold" href="/">procs</a>
  </header>
  ${ctx.fns.chat.column({})}
</aside>
<section class="flex-1 min-w-0 flex flex-col" hx-boost="true" hx-target="#main" hx-swap="innerHTML">
  ${ctx.fns.ui.tabs({ path })}
  <main id="main" class="flex-1 min-h-0 overflow-y-auto bg-bg-content p-6">${opts.main}</main>
</section>
</body>
</html>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

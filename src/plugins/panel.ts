// The plugin manager: what is mounted, what the project asked for but has not
// got, and what the machine could offer. A plugin is one folder with up to four
// faces — library, tab, skill, service provider — and the badges below are read
// off its files, not declared anywhere.
export default async function (ctx: Context, _session: Session | null, opts: { message?: string; error?: string }): Promise<string> {
    const mounted = ctx.fns.plugins.list({});
    const declared = await ctx.fns.plugins.readDeclared({ workdir: ctx.fns.project.workdir({}) });
    const missing = Object.entries(declared).filter(([name]) => !mounted.some(p => p.namespace === name));
    const catalog = await ctx.fns.plugins.catalog({});

    const badge = (text: string, tone = "neutral") =>
        `<span class="rounded-sm border border-state-${tone}-border bg-state-${tone}-bg px-1.5 py-0.5 text-3xs text-state-${tone}-fg">${esc(text)}</span>`;

    const plugin = (p: (typeof mounted)[number]) => `<div class="flex items-start gap-3 border-t border-border-subtle px-4 py-3">
  <i class="ph ${esc(p.icon)} mt-0.5 text-base text-text-tertiary" aria-hidden="true"></i>
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-2">
      ${p.tab ? `<a class="font-medium text-text-link hover:underline" href="/${esc(p.namespace)}">${esc(p.label)}</a>` : `<span class="font-medium">${esc(p.label)}</span>`}
      <span class="font-mono text-2xs text-text-tertiary">${esc(p.namespace)}</span>
      ${badge(p.source)}
      ${p.tab ? badge("tab", "info") : ""}
      ${p.skill ? badge("skill", "success") : ""}
      ${p.provides.map(s => badge(`service:${s}`, "warning")).join("")}
      ${p.preview ? badge(`previews ${p.preview.files}`, "info") : ""}
      ${p.fns.length ? badge(`${p.fns.length} fns`) : ""}
    </div>
    ${p.description ? `<div class="mt-0.5 text-2xs text-text-muted">${esc(p.description)}</div>` : ""}
    <div class="mt-0.5 truncate font-mono text-3xs text-text-placeholder" title="${esc(p.dir)}">${esc(p.dir)}</div>
    ${Object.keys(p.config).length ? `<div class="mt-1 font-mono text-3xs text-text-tertiary">${esc(JSON.stringify(p.config))}</div>` : ""}
  </div>
  ${!p.optional ? `<span class="shrink-0 text-2xs text-text-placeholder">always on</span>`
        : `<button class="shrink-0 rounded-md border border-border-input px-2 py-1 text-2xs hover:border-state-danger-border hover:bg-state-danger-bg hover:text-state-danger-fg"
      data-action="turn-off" data-entity="plugin" data-id="${esc(p.namespace)}"
      hx-post="/plugins/remove" hx-vals='{"name":${JSON.stringify(p.namespace)}}'>Turn off</button>`}
</div>`;

    const gap = ([name, config]: [string, Record<string, any>]) => `<div class="flex items-center gap-3 border-t border-border-subtle px-4 py-3">
  <i class="ph ph-warning-circle text-base text-state-warning-fg" aria-hidden="true"></i>
  <div class="min-w-0 flex-1">
    <div class="font-medium">${esc(name)}</div>
    <div class="font-mono text-3xs text-text-tertiary">${esc(config.git ?? config.path ?? "no git or path — and nothing by that name in the catalogue")}</div>
  </div>
  ${config.git ? `<button class="shrink-0 rounded-md border border-border-input px-2 py-1 text-2xs hover:bg-bg-tertiary" data-action="fetch" data-entity="plugin" data-id="${esc(name)}"
    hx-post="/plugins/fetch" hx-vals='{"name":${JSON.stringify(name)}}'>Fetch</button>` : ""}
  <button class="shrink-0 rounded-md border border-border-input px-2 py-1 text-2xs hover:border-state-danger-border hover:bg-state-danger-bg hover:text-state-danger-fg"
    data-action="turn-off" data-entity="plugin" data-id="${esc(name)}"
    hx-post="/plugins/remove" hx-vals='{"name":${JSON.stringify(name)}}'>Turn off</button>
</div>`;

    const available = (p: (typeof catalog)[number]) => `<div class="flex items-center gap-3 border-t border-border-subtle px-4 py-3">
  <i class="ph ${esc(p.icon)} text-base text-text-tertiary" aria-hidden="true"></i>
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-2"><span class="font-medium">${esc(p.label)}</span><span class="font-mono text-2xs text-text-tertiary">${esc(p.namespace)}</span>${p.skill ? badge("skill", "success") : ""}</div>
    ${p.description ? `<div class="mt-0.5 text-2xs text-text-muted">${esc(p.description)}</div>` : ""}
    <div class="mt-0.5 truncate font-mono text-3xs text-text-placeholder">${esc(p.dir)}</div>
  </div>
  <button class="shrink-0 rounded-md border border-border-input px-2 py-1 text-2xs hover:border-brand hover:bg-accent-soft hover:text-brand" data-action="turn-on" data-entity="plugin" data-id="${esc(p.namespace)}"
    hx-post="/plugins/add" hx-vals='{"name":${JSON.stringify(p.namespace)}}'>Turn on</button>
</div>`;

    const box = (title: string, rows: string, empty: string) => `<div class="mt-4 overflow-hidden rounded-md border border-border-subtle">
  <div class="bg-bg-tertiary px-4 py-2 text-2xs text-text-tertiary">${esc(title)}</div>
  ${rows || `<div class="border-t border-border-subtle px-4 py-3 text-2xs text-text-tertiary">${esc(empty)}</div>`}
</div>`;

    return `<h1 class="text-lg font-semibold">Plugins</h1>
<p class="mt-1 text-2xs text-text-tertiary">A plugin is a folder: its functions are a library, a <span class="font-mono">GET /namespace</span> route makes it a tab, a <span class="font-mono">SKILL.md</span> makes it a skill for the agent. The workspace's own are always on; the rest are named in <span class="font-mono">workspace.json</span>.</p>
${opts.error ? `<div class="mt-4 rounded-md border border-state-danger-border bg-state-danger-bg px-4 py-2 text-ui text-state-danger-fg">${esc(opts.error)}</div>` : ""}
${opts.message ? `<div class="mt-4 rounded-md border border-state-success-border bg-state-success-bg px-4 py-2 text-ui text-state-success-fg">${esc(opts.message)}</div>` : ""}
${box(`${mounted.length} on`, mounted.map(plugin).join(""), "nothing mounted")}
${missing.length ? box(`${missing.length} declared, not mounted`, missing.map(gap).join(""), "") : ""}
${box(`${catalog.length} available — off`, catalog.map(available).join(""), "every plugin on this machine is already on")}

<form class="mt-4 flex items-center gap-2" hx-post="/plugins/add" data-form="plugin-add">
  <input name="name" data-field="name" placeholder="name" class="w-40 rounded-md border border-border-input px-3 py-1.5 text-ui outline-none focus:border-border-focus">
  <input name="git" data-field="git" placeholder="https://github.com/acme/plugin (leave empty for a platform plugin)"
    class="flex-1 rounded-md border border-border-input px-3 py-1.5 text-ui outline-none focus:border-border-focus">
  <button class="rounded-md bg-brand px-3 py-1.5 text-ui text-text-inverse hover:bg-brand-hover" data-action="add">Add</button>
</form>`;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

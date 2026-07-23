// The plugin manager: what is mounted, what the project asked for but has not
// got, and what the machine could offer. A plugin is one folder with up to four
// faces — library, tab, skill, service provider — and the badges below are read
// off its files, not declared anywhere.
export default async function (ctx: Context, _session: Session | null, opts: { message?: string; error?: string }): Promise<string> {
    const mounted = ctx.fns.plugins.list({});
    const declared = await ctx.fns.plugins.readDeclared({ workdir: ctx.fns.project.workdir({}) });
    const missing = Object.entries(declared).filter(([name]) => !mounted.some(p => p.namespace === name));
    const catalog = await ctx.fns.plugins.catalog({});

    // A plugin is a card, not a row of cells: an icon, a line of badges, a
    // description and a path — so the markup stays here and only the parts that
    // are the shared thing (badges, buttons, the box, the page) come from ui.
    const plugin = (p: (typeof mounted)[number]) => `<div ${ctx.fns.ui.attr({ entity: "plugin", id: p.namespace, status: "on" })} class="flex items-start gap-3 border-t border-border-subtle px-4 py-3">
  <i class="ph ${esc(p.icon)} mt-0.5 text-base text-text-tertiary" aria-hidden="true"></i>
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-2">
      ${p.tab ? `<a ${ctx.fns.ui.attr({ role: "label" })} class="font-medium text-text-link hover:underline" href="/${esc(p.namespace)}">${esc(p.label)}</a>` : `<span ${ctx.fns.ui.attr({ role: "label" })} class="font-medium">${esc(p.label)}</span>`}
      <span ${ctx.fns.ui.attr({ role: "namespace" })} class="font-mono text-2xs text-text-tertiary">${esc(p.namespace)}</span>
      ${ctx.fns.ui.badge({ text: p.source, role: "source" })}
      ${p.tab ? ctx.fns.ui.badge({ text: "tab", tone: "info" }) : ""}
      ${p.skill ? ctx.fns.ui.badge({ text: "skill", tone: "success" }) : ""}
      ${p.provides.map(s => ctx.fns.ui.badge({ text: `service:${s}`, tone: "warning" })).join("")}
      ${p.preview ? ctx.fns.ui.badge({ text: `previews ${p.preview.files}`, tone: "info" }) : ""}
      ${p.fns.length ? ctx.fns.ui.badge({ text: `${p.fns.length} fns` }) : ""}
    </div>
    ${p.description ? `<div class="mt-0.5 text-2xs text-text-muted">${esc(p.description)}</div>` : ""}
    <div ${ctx.fns.ui.attr({ role: "dir" })} class="mt-0.5 truncate font-mono text-3xs text-text-placeholder" title="${esc(p.dir)}">${esc(p.dir)}</div>
    ${Object.keys(p.config).length ? `<div class="mt-1 font-mono text-3xs text-text-tertiary">${esc(JSON.stringify(p.config))}</div>` : ""}
  </div>
  ${!p.optional ? `<span class="shrink-0 text-2xs text-text-placeholder">always on</span>`
        : ctx.fns.ui.button({ action: "turn-off", label: "Turn off", entity: "plugin", id: p.namespace, post: "/plugins/remove", vals: { name: p.namespace }, tone: "danger" })}
</div>`;

    const gap = ([name, config]: [string, Record<string, any>]) => `<div ${ctx.fns.ui.attr({ entity: "plugin", id: name, status: "declared" })} class="flex items-center gap-3 border-t border-border-subtle px-4 py-3">
  <i class="ph ph-warning-circle text-base text-state-warning-fg" aria-hidden="true"></i>
  <div class="min-w-0 flex-1">
    <div ${ctx.fns.ui.attr({ role: "namespace" })} class="font-medium">${esc(name)}</div>
    <div ${ctx.fns.ui.attr({ role: "source" })} class="font-mono text-3xs text-text-tertiary">${esc(config.git ?? config.path ?? "no git or path — and nothing by that name in the catalogue")}</div>
  </div>
  ${config.git ? ctx.fns.ui.button({ action: "fetch", label: "Fetch", entity: "plugin", id: name, post: "/plugins/fetch", vals: { name } }) : ""}
  ${ctx.fns.ui.button({ action: "turn-off", label: "Turn off", entity: "plugin", id: name, post: "/plugins/remove", vals: { name }, tone: "danger" })}
</div>`;

    const available = (p: (typeof catalog)[number]) => `<div ${ctx.fns.ui.attr({ entity: "plugin", id: p.namespace, status: "off" })} class="flex items-center gap-3 border-t border-border-subtle px-4 py-3">
  <i class="ph ${esc(p.icon)} text-base text-text-tertiary" aria-hidden="true"></i>
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-2"><span ${ctx.fns.ui.attr({ role: "label" })} class="font-medium">${esc(p.label)}</span><span ${ctx.fns.ui.attr({ role: "namespace" })} class="font-mono text-2xs text-text-tertiary">${esc(p.namespace)}</span>${p.skill ? ctx.fns.ui.badge({ text: "skill", tone: "success" }) : ""}</div>
    ${p.description ? `<div class="mt-0.5 text-2xs text-text-muted">${esc(p.description)}</div>` : ""}
    <div ${ctx.fns.ui.attr({ role: "dir" })} class="mt-0.5 truncate font-mono text-3xs text-text-placeholder">${esc(p.dir)}</div>
  </div>
  <button class="shrink-0 rounded-md border border-border-input px-2 py-1 text-2xs hover:border-brand hover:bg-accent-soft hover:text-brand" ${ctx.fns.ui.attr({ action: "turn-on", entity: "plugin", id: p.namespace })}
    hx-post="/plugins/add" hx-vals='{"name":${JSON.stringify(p.namespace)}}' hx-target="#main" hx-swap="innerHTML">Turn on</button>
</div>`;

    return ctx.fns.ui.page({
        page: "plugins",
        title: "Plugins",
        lead: `A plugin is a folder: its functions are a library, a <span class="font-mono">GET /namespace</span> route makes it a tab, a <span class="font-mono">SKILL.md</span> makes it a skill for the agent. The workspace's own are always on; the rest are named in <span class="font-mono">workspace.json</span>.`,
        main: `
${opts.error ? `<div class="mt-4">${ctx.fns.ui.notice({ text: opts.error, tone: "danger" })}</div>` : ""}
${opts.message ? `<div class="mt-4">${ctx.fns.ui.notice({ text: opts.message, tone: "success" })}</div>` : ""}
${ctx.fns.ui.box({ class: "mt-4", title: `${mounted.length} on`, body: mounted.map(plugin).join(""), empty: "nothing mounted" })}
${missing.length ? ctx.fns.ui.box({ class: "mt-4", title: `${missing.length} declared, not mounted`, body: missing.map(gap).join(""), empty: "" }) : ""}
${ctx.fns.ui.box({ class: "mt-4", title: `${catalog.length} available — off`, body: catalog.map(available).join(""), empty: "every plugin on this machine is already on" })}

${ctx.fns.ui.form({
            form: "plugin-add", post: "/plugins/add", class: "mt-4 flex items-center gap-2",
            body: ctx.fns.ui.field({ name: "name", placeholder: "name", class: "w-40" })
                + ctx.fns.ui.field({ name: "git", placeholder: "https://github.com/acme/plugin (leave empty for a platform plugin)" })
                + ctx.fns.ui.button({ action: "add", label: "Add", tone: "primary" }),
        })}`,
    });
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

# Plugins — one folder, four faces

A plugin is a directory with `atomic-workspace.json` and a `src/` of ordinary
procs functions. That is the whole contract. What the plugin *is* — a library,
a tab, a skill, a service provider — is not declared anywhere: it is read off
the files it ships.

| face | how the workspace knows | who uses it |
|---|---|---|
| **library** | it has functions | the app, other plugins, the REPL — `ctx.fns.<namespace>.*` |
| **devtool** | it answers `GET /<namespace>` | the human, as a tab in the right pane |
| **skill** | it ships a `SKILL.md` | the coding agent |
| **provider** | it has `$hook_service.<x>.ts` | `services` in `workspace.json` |
| **viewer** | its manifest claims a file pattern | the file manager, instead of showing text |
| **browser code** | it ships a `client.js` | the layout loads it, so its markup can call `hx-on--load` |

A plugin can wear any subset. `filemanager` is a library and a tab; `aidbox` is
a library, a tab and the provider of the `aidbox` service; a plugin that is only
`SKILL.md` plus two functions is a library the agent knows how to use, and it
gets no tab because it has no page to show.

## The manifest

```jsonc
// atomic-workspace.json
{
  "namespace": "labs",     // ctx.fns.labs.*, GET /labs   (default: the folder name)
  "src": "src",            // where the functions are     (default: "src")
  "label": "Labs",         // the tab                     (default: the namespace, capitalised)
  "icon": "ph-flask",      // a Phosphor class            (default: ph-squares-four)
  "description": "…",      // one line                    (default: SKILL.md's frontmatter description)
  "optional": true,        // wait to be asked for        (default: false — mount on sight)
  "preview": { "files": "$qr_*.json", "fn": "preview" }   // files this plugin renders itself
}
```

Seven keys, and six of them have defaults. The description falls back to the
`description:` a `SKILL.md` already carries, so a plugin that is also a skill
writes its sentence once.

A plugin that needs behaviour in the browser adds `src/client.js` and the route
that serves it (`$route_client.js_GET.ts`, a text import). The layout then loads
it on every page, so an `hx-on--load` in the plugin's markup can count on it
being there — which is how a fragment stays free of JavaScript.
`plugins/chart` is the example: it fetches Vega the first time a chart is drawn
rather than on every page load.

`"optional": true` is how a plugin ships with the workspace without being in
every project: it is discovered, listed in the catalogue, and mounted only once
`workspace.json` names it. `plugins/questionnaire` and `plugins/viewdef` are
both this — a FHIR form library and a SQL-on-FHIR inspector are not things every
project wants a tab for.

`"preview"` claims a kind of file. A `$qr_*.json` is not JSON to a person, it is
a form, so the file manager stops highlighting it and calls
`ctx.fns.questionnaire.preview({ path })` instead, showing whatever html comes
back. The pattern is a glob matched against the file name, or against the path
inside the project when it contains a slash. Returning `null` hands the file
back — a malformed form is more useful as JSON with its syntax highlighted than
as a blank frame — and the first plugin whose pattern matches wins.

## Where plugins live

**A plugin is a skill directory.** The project keeps its own in
`WORKDIR/.claude/skills/<name>/` — exactly where the coding agent already looks
for skills. One folder, and both find it: the agent by `SKILL.md`, the workspace
by `atomic-workspace.json`.

| source | where | how it is asked for |
|---|---|---|
| `core` | the workspace's own `plugins/` | nothing — it is part of the workspace |
| `project` | `WORKDIR/.claude/skills/*` | nothing — it is the project's own folder |
| `platform` | `~/.claude/skills`, `~/.agent/skills`, `~/.codex/skills` | by name in `workspace.json` |
| `external` | a git repo | `{ "git": … }` in `workspace.json` |

One rule decides mounting, whatever the source: **a plugin mounts unless it is
optional and nobody asked for it.** Optional means its manifest says so, or it
came from a global skill directory — a machine has dozens of those and a project
wants three. What gets skipped here is exactly what `plugins.catalog()` offers.

`PLUGIN_PATHS` (colon-separated) replaces the search list; `./…` in it resolves
against the workspace's repo, everything else against the project.

`plugins.catalog()` is what is available and unasked-for; naming one in the
manifest mounts it.

## The manifest asks, the runtime obeys

```jsonc
// WORKDIR/workspace.json
{
  "services": { … },
  "plugins": {
    "fhir-viewer": {},                                  // platform, by name
    "billing":     { "git": "https://github.com/acme/billing" },
    "aidbox":      { "license": "…" }                   // core, configured
  }
}
```

The value is **always an object**. `git` and `path` are reserved — they say
where the plugin comes from; everything else is that plugin's **config**, and it
arrives through the ordinary door: `ctx.fns.config.resolve({ module })` layers
`defaults < package.json proc.prod.<ns> < workspace.json plugins.<ns> < env`.
Same grammar as `services`, where the name is the type and `cmd`/`url` say how.

At boot the runtime reads that map, clones the externals it does not have yet
(`git clone --depth 1` into `WORKDIR/.claude/skills/<name>`, added to the
project's `.git/info/exclude` so it stays out of the user's commits and remains
updatable), and mounts everything. A plugin declared but not on disk is not
silently dropped: it shows in the manager with a **Fetch** button.

## Installing is an edit and a reload

```sh
.workspace/repl 'ctx.fns.plugins.list({})'                                    # mounted, with each one's faces
.workspace/repl 'await ctx.fns.plugins.catalog({})'                           # available, not asked for
.workspace/repl 'await ctx.fns.plugins.add({ name: "fhir-viewer" })'          # platform
.workspace/repl 'await ctx.fns.plugins.add({ name: "billing", git: "https://github.com/acme/billing" })'
.workspace/repl 'await ctx.fns.plugins.remove({ name: "billing" })'
.workspace/repl 'await ctx.fns.plugins.reload({})'                            # after editing by hand
```

`add` writes `workspace.json`, fetches if there is a repo, and remounts;
`reload` re-runs discovery, `loadFns`, the lint, `genTypes` and `loadRoutes` on
the root ctx. **No restart** — the chat session, the event stream and the
supervised services stay up, and the new tab appears in the strip.

Removing is un-asking, not deleting: the clone stays where it is, so adding it
back costs nothing. Its functions live in the running registry until a restart
(like any deleted file); routes and types rebuild at once, so the tab goes.

## The manager

`/plugins` — the button on the right of the tab strip. Per plugin: its icon and
label, its namespace, its source, a badge per face, the sentence from its
manifest, where it came from, and the config the manifest passed it. Below,
what the project declared but has not got, and the catalogue with an **Add** on
each row.

## Make it drivable

A tab is not finished when it renders. The workspace shows a page to the user by
pointing at its `data-*` markers — one `page` on the root, `entity`+`id` on every
row, `role` on the cells worth reading, `action` on every control, `form` on
every form — and unmarked markup is invisible to that.

Build the page out of `src/ui/` and the markers come for free: `ui.page`,
`ui.box`, `ui.row`, `ui.button`, `ui.field`, `ui.form`, `ui.notice`, `ui.badge`.
Keep the page's state in its URL, too — then showing it to someone is one
`page.open`. The convention, the components and the verbs are in
[ui.md](./ui.md); `plugins/viewdef` is the shortest example that has all of it.

## What the agent gets

The block written into `WORKDIR/CLAUDE.md` lists every mounted plugin, what it
is, and the path to its `SKILL.md` — an index, not the bodies. The agent reads
the file when it needs the plugin, the same progressive disclosure Claude skills
use. Plugins under `WORKDIR/.claude/skills` need none of that: the agent finds
them natively, because they were skills all along.

## The functions

| | |
|---|---|
| discovery | `project.pluginPaths` · `project.roots` · `plugins.readDeclared` · `plugins.describe` |
| reading | `plugins.list` · `plugins.catalog` |
| managing | `plugins.add` · `plugins.remove` · `plugins.fetch` · `plugins.reload` |
| UI | `plugins.panel` + `GET /plugins`, `POST /plugins/{add,remove,fetch}` |

`loadFns` is where a plugin becomes real, so it is where its record is built —
one shape (`$state_plugins.ts`) read by the tab strip, the manager and the
agent's index alike.

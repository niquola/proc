# Workspace architecture

A **workspace** is one Bun process that stands between a developer, an AI agent
and a project: it supervises the project's services, hosts the agent, renders a
plugin UI, and lets both the agent and the developer manipulate everything at
runtime through a REPL. It is built on [procs](./CLAUDE.md) — functions on disk
become `ctx.fns` at runtime, and the process is edited in place, never restarted.

The shape in one picture:

```
 ┌──────────────────────── the browser tab ─────────────────────────┐
 │  chat (agent)          │  tabs: filemanager · preview · …        │
 │  ┌──────────────────┐  │  ┌───────────────────────────────────┐  │
 │  │ transcript       │  │  │ #main — one plugin's page         │  │
 │  │ composer         │  │  └───────────────────────────────────┘  │
 │  └──────────────────┘  │        ▲ htmx partial swap              │
 └───────────┬────────────┴────────┼─────────────────────────────────┘
             │ SSE: {type:"eval"}  │ POST /page/result
             ▼                     │
 ┌──────────────────── the workspace process ──────────────────────┐
 │  agent/   ACP session over WORKDIR   ─────────► CLAUDE.md block  │
 │  page/    inject JS into the tab, await the answer               │
 │  services/ supervise workspace.json on free ports                │
 │  plugins/ mounted by discovery, one tab each                     │
 │  repl/    POST /repl — evaluate inside this process              │
 └───────────┬──────────────────────────┬───────────────────────────┘
             │ Bun.spawn                │ Bun.spawn (stdio, ACP)
             ▼                          ▼
      app · aidbox · …            claude-agent-acp
      (the project in WORKDIR, one shared env)
```

Two directories, deliberately separate:

| | what it is | how it is set |
|---|---|---|
| `projectRoot` | where the workspace's own `src/`, `package.json` and generated types live | `boot({root})`, defaults to the repo |
| `WORKDIR` | the project being worked on — listed, supervised, edited by the agent | `WORKDIR` env, defaults to `projectRoot` |

Keeping them apart is what lets one workspace build (`~/procs`) supervise a
different project (`~/workspace-template-test`) without either one leaking into
the other.

## Plugins: a folder with a manifest

A plugin is a directory with `atomic-workspace.json` (`{ namespace?, src?, label?,
icon?, description? }`) and a `src/` tree of ordinary procs functions — and it is
a **skill directory**: the project keeps its own in `WORKDIR/.claude/skills/`,
where the coding agent finds them as skills and the workspace as plugins. What a
plugin is comes from its files: functions are a library, a `GET /<namespace>`
route is a tab, a `SKILL.md` is a skill, a `$hook_service.<x>.ts` is a service
provider, and `"preview": { "files": "$qr_*.json", "fn": "preview" }` in the
manifest makes it the viewer for those files — the file manager calls that
function instead of highlighting the text, so a Questionnaire opens as a form.

One rule decides mounting, whatever the source: a plugin mounts unless it is
optional and nobody asked for it. The workspace's own `plugins/` and the
project's own skills are on by default; a manifest can say `"optional": true`,
and the global skill dirs are optional by nature — a machine has dozens, a
project wants three. Whatever is skipped is exactly what the catalogue offers.
An external is a git repo cloned into `.claude/skills/`. Config travels the same
manifest: `"plugins": { "aidbox": { "license": … } }` in `workspace.json` reaches
the plugin through `config.resolve`, layered between `package.json` and env. See
`docs/plugins.md`. `project/pluginPaths.ts` searches
the project's own `plugins/` plus every place skills live (`~/.claude/skills`,
`~/.agent/skills`, `~/.codex/skills`, `<root>/.claude/skills`,
`<root>/.agents/skills`), deduped by `realpath`; `PLUGIN_PATHS` overrides the
list. `project/roots.ts` turns each hit into a scan root, and from there plugin
code is indistinguishable from first-party code: `filemanager/list.ts` becomes
`ctx.fns.filemanager.list`, `$route__GET.ts` becomes `GET /filemanager`, types
and lint and the production bundle all apply.

Mounting is therefore **a file, not a registration** — dropping a folder in
`plugins/` adds a namespace and a tab. `loadFns` records the mounted namespaces
in `ctx.state.plugins`; the layout renders one tab per namespace, which is why
the UI grows by itself. The older declarative path (`proc.plugins` in
`package.json`, npm/git specs) still works for published packages.

Shipped plugins: `filemanager` (browse WORKDIR, markdown and syntax-highlighted
code), `preview` (the app under development in a frame), `services` → namespace
`processes` (what is running, its logs, restart/stop), `aidbox` (a *provider*,
no UI — see below), plus two that are `"optional": true` — they ship with the
workspace but wait to be named in `workspace.json`: `questionnaire` (the FHIR
form library), `viewdef` (SQL-on-FHIR ViewDefinitions, their columns and the rows
their tables hold) and `chart` (Vega-Lite charts over those views). The three
compose: a view flattens FHIR into a table, a chart draws a SELECT over it, and a
questionnaire is what put the data there.

The manager at `/plugins` is where this is visible and changeable: every mounted
plugin with a badge per face, what the project declared but has not fetched, and
the catalogue of what this machine could offer — Turn on / Turn off, which is a
line in `workspace.json` plus `plugins.reload`, never a restart.

## Services: declare what you need, not how to run it

`WORKDIR/workspace.json` lists the project's services the way GitHub Actions
lists them — **the name is the type**:

```jsonc
{ "services": {
    "aidbox":   { "license": "…" },                                  // a request
    "temporal": { "cmd": "docker compose up temporal", "portEnv": ["TEMPORAL_PORT"],
                  "publish": { "TEMPORAL_ADDRESS": "localhost:${TEMPORAL_PORT}" } },
    "app":      { "cmd": "bun run dev", "portEnv": "PORT",
                  "needs": ["aidbox", "temporal"], "ready": { "http": "/" } } } }
```

`services.resolve` uses a declaration as-is when it already says `cmd` (run this)
or `url` (it exists, just publish the address). Otherwise the declaration is a
request, and it is handed to the `service.<name>` hook — whichever plugin can
provide that service answers. `plugins/aidbox` does exactly this: with an
external `AIDBOX_BASE_URL` it returns that URL, otherwise it returns
`docker compose up aidbox` plus the ports, the readiness probe and the
credentials Aidbox needs. Swapping a local container for a shared instance is one
line in the manifest, not a branch in the code. `resolve` is also the only place
defaults live, and where a manifest that contradicts itself throws — a `needs`
cycle, a `needs` on nothing, two services publishing the same key.

A service can also declare `runtime: "in-process"`, and then nothing is spawned:
its `src/` joins the scan roots under its own namespace, so the project's own
code becomes `ctx.fns.app.*` and its `$route_*` files are served by the workspace
at `/app/…`. The app is a plugin that happens to live in WORKDIR — no port, no
readiness, no supervision, an edit live after `dev.sync`, and the agent calling
its functions directly rather than over HTTP. The price is the absence of
isolation: an in-process app crashes the workspace with it, so it is a choice a
project makes in its manifest, not the default.

`services.env` computes the environment: a free port (`Bun.serve({port:0})`) for
every name in `portEnv`, the resulting address in `urlEnv`, everything a service
`publish`es, `${NAME}` references resolved — and hands that one environment to
every service. This is why the app finds Aidbox without any glue: both were
started with the same `AIDBOX_BASE_URL`. `env` on a declaration is the exception:
it belongs to that one child (a license, a database password), so it never
reaches the others. Ports are unique per run, so several workspaces coexist on
one machine, and `ctx.state.serviceEnv` only ever *fills in* what is missing —
restarts keep their address, and a service added to the manifest after boot gets
one without moving anybody else's.

**Readiness is a start gate, not a monitor.** A service declares `ready` as
`{http:"/path"}` (any answer below 500), `{tcp:true}` (the default once the
workspace assigned it a port) or `{log:"substring"}`; nothing declared means ready
as soon as it is spawned. `needs` waits for *ready*, not merely started, so there
is no sort function anywhere: `start` awaits the services it needs (starting an
idle one itself), independent services still come up in parallel, and the cycle
check keeps the recursion finite. A dependency that misses its `ready.timeout`
does not block the dependent — it starts anyway and says so on its card. Nothing
probes a service after it is up: a process that is alive but sick is something you
read the logs of, and killing it would delete the evidence.

**A crash is an exit while the supervisor still wants the service up.** `stop`
(and therefore `restart`) sets `wanted = "down"` before it signals, so an intended
exit costs nothing. A real crash retries with a delay that doubles from `backoff`
up to 30 s and gives up after `maxRestarts` consecutive tries — the counter resets
after ten seconds of healthy uptime, so a service that dies once an hour restarts
forever and one that dies in 200 ms lands in `crashed` with its exit code and its
logs still on screen. A clean exit is not a failure (`restart: "on-failure"` is the
default). Children are spawned `detached`, so `stop` signals the whole process
group — SIGTERM, five seconds, SIGKILL — which is what takes `sh -lc "…"` down
together with the bun or docker under it, leaving no orphan on a port.

`services.start/stop/restart/status/logs/waitReady` are the surface; logs are an
in-memory ring per service (2000 lines, ANSI stripped, one monotonic `seq` per
line), so there are no files to tail. One record per *declared* service lives on
`ctx.state.services` and is never deleted while it runs — a stopped service keeps
its card, its logs and its port. `$start.ts` brings everything up with the
workspace and `$stop.ts` takes it down.

The `processes` tab renders those records directly. Two streams carry it: every
state transition emits `{type:"service"}` on the shared `/events` stream and the
list refetches itself, while log lines go over a per-service SSE cursor
(`/processes/:name/logs/stream`, resumed by `Last-Event-ID`) — the ring is the
transcript, the stream only walks it, so a reconnect replays nothing and a chatty
service cannot flood the other tabs.

## The agent: a session over WORKDIR

`agent.start` spawns `@agentclientprotocol/claude-agent-acp` over stdio and
opens an ACP session with `cwd = WORKDIR`. `receive` folds session updates into
a transcript — text and thinking chunks append to the last message of their
kind, tool calls are entries updated in place by `toolCallId` — and every update
emits an SSE event, so the chat repaints without polling. `prompt` returns
immediately; the answer arrives as updates. `models`/`setModel` switch the model
through the ACP config option.

The interesting part is what happens **before** the session opens. The workspace
prepares the workdir so the agent discovers its powers by reading the project:

- `writeHelpers` generates `.workspace/repl` and `.workspace/app-repl`
  (code as an argument or on stdin) and adds `.workspace/` to
  `.git/info/exclude` — the project's own `.gitignore` is untouched.
- `injectContext` rewrites a managed block at the top of `WORKDIR/CLAUDE.md`,
  between `<!-- workspace-runtime:start/end -->`: the service table with this
  run's ports, the injected environment, both REPLs with worked examples, how to
  drive the UI, how to ask the user with a form, and the rules.

Both are regenerated on every start, so the instructions can never drift from
the running ports. Nothing else in `CLAUDE.md` is touched.

## Two REPLs, and why they matter

`POST /repl` evaluates code inside a running process with its `ctx` in scope —
the workspace has one, the supervised app has its own. This is the spine of the
whole design: instead of restarting a service to see what it holds, or adding
`console.log` and waiting for a rebuild, you ask the process. The agent uses the
same door as the developer (`.workspace/repl 'ctx.fns.services.status({})'`),
which means anything a human can do here, the agent can do — and vice versa,
with no second API to keep in sync.

## Driving the UI: injection, not automation

There is no browser inside the workspace, and in the cluster there will not be
one. The runtime is the user's own tab. `page.eval` pushes
`{type:"eval", id, code}` down the SSE stream; the layout's handler runs it as an
async function body and posts the result back to `POST /page/result`, where a
pending promise resolves. That is the whole bridge — a few dozen lines, no CDP,
no headless Chrome. Only the tab the user is looking at answers: a hidden one
waits, and a tab left from an older version of the page keeps quiet.

On that wire sits `window.page` (`src/page/client.js`) — one resolver, one
catalogue and the verbs — with a thin server function per verb in `src/page/`.
Nothing addresses the screen by CSS selector. Everything goes through the
`data-*` markers `ctx.fns.ui.attr` emits: `page` on the root, `entity`+`id` on a
row, `role` on a cell, `action` on a control, `form` on a form. A restyle cannot
break the agent, and an unmarked element is simply invisible to it.

`page.state` returns what is on the screen in exactly that vocabulary — the
entities, the actions, the forms with their fields — built by the same resolver
the verbs use, so a name it reports is a name that works and a name it omits is
one that will not. Look, then act; do not guess selectors. The verbs are `open`
(a URL, or an entity whose own link is followed), `openTab`, `point`, `say`,
`click`, `fill`, `submit`, `text` and `tour`. Each acting verb flies a pointer to
its target and lights it up first, so the user sees what the workspace pressed
instead of the page changing by itself.

Navigation stays partial by design. `toResponse` returns just `main` (plus the
tab strip with `hx-swap-oob`) when the request carries `HX-Request`; tabs are
`hx-get` + `hx-target="#main"` + `hx-push-url`; `page.open` injects
`htmx.ajax(...)` and `history.pushState`. The URL changes for real while the
chat, the SSE stream and this bridge stay alive — a full reload would kill all
three, which is why it is banned in the agent's rules. It also means a plugin
page can keep its whole state in its URL (`/questionnaire?q=…`,
`/viewdef/view?id=…`), and putting the user in front of something is then one
call rather than a sequence of clicks.

`page.tour` runs a list of steps against that page — open, point, say, click,
fill, submit, wait — with narration as a first-class step, so the workspace can
walk someone through a plugin instead of describing it. `docs/ui.md` is the
guide.

## Design rules that hold it together

- **One shape, one door.** Every capability is a `ctx.fns` function; HTTP routes,
  the agent's shell helpers and the UI all call the same functions.
- **Declare, then provide.** Manifests say *what* (`workspace.json`,
  `atomic-workspace.json`); hooks and providers decide *how* — that is what makes
  local compose, an external URL and a future cluster provider interchangeable.
- **Nothing hardcoded per run.** Ports, URLs and credentials are computed at
  start and published through one environment and one generated document.
- **The live process is the source of truth.** Prefer asking the REPL over
  reading code; prefer `dev.sync` over restarting; prefer injecting into the open
  page over automating a browser.
- **Guest code stays a guest.** Generated helpers live in `.workspace/` with a
  local git exclude, the `CLAUDE.md` block lives between markers — the project's
  files remain the project's.

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

A plugin is a directory with `atomic-workspace.json` (`{ namespace?, src? }`)
and a `src/` tree of ordinary procs functions. `project/pluginPaths.ts` searches
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
`processes` (what is running, its logs, restart/stop), `form` (ask the user
something), `aidbox` (a *provider*, no UI — see below).

## Services: declare what you need, not how to run it

`WORKDIR/workspace.json` lists the project's services the way GitHub Actions
lists them — **the name is the type**:

```jsonc
{ "services": {
    "aidbox": { "license": "…" },                                    // a request
    "app":    { "cmd": ["bun", "run", "dev"], "portEnv": "PORT" } } } // or a recipe
```

`services.resolve` uses a declaration as-is when it already says `cmd` (run this)
or `url` (it exists, just publish the address). Otherwise the declaration is a
request, and it is handed to the `service.<name>` hook — whichever plugin can
provide that service answers. `plugins/aidbox` does exactly this: with an
external `AIDBOX_BASE_URL` it returns that URL, otherwise it returns
`docker compose up aidbox` plus the ports and credentials Aidbox needs. Swapping
a local container for a shared instance is one line in the manifest, not a
branch in the code.

`services.env` computes the environment **once** per run: a free port
(`Bun.serve({port:0})`) for every name in `portEnv`, the resulting address in
`urlEnv`, `${NAME}` references resolved — and hands that one environment to every
service. This is why the app finds Aidbox without any glue: both were started
with the same `AIDBOX_BASE_URL`. Ports are unique per run, so several workspaces
coexist on one machine; restarts keep the assigned ports because the environment
is cached in `ctx.state.serviceEnv`.

`services.start/stop/restart/status/logs` are the surface; logs are an in-memory
ring buffer per service, so there are no files to tail. `$start.ts` brings
everything up with the workspace and `$stop.ts` takes it down.

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
no headless Chrome.

Navigation is partial by design. `toResponse` returns just `main` (plus the tab
strip with `hx-swap-oob`) when the request carries `HX-Request`; tabs are
`hx-get` + `hx-target="#main"` + `hx-push-url`; `page.open` injects
`htmx.ajax(...)` and `history.pushState`. The URL changes for real, while the
chat, the SSE stream and this bridge stay alive — a full reload would kill all
three, which is why it is banned in the agent's rules.

Elements are addressed by the data-* convention borrowed from the template, never
by CSS selectors: `page.fill({form, values})` and `page.submit({form})` work on
`[data-form]`, `page.click({action, entity, id})` on `[data-action]` scoped by
`[data-entity][data-id]`. Restyling a plugin cannot break the agent.

## Forms: the agent asks, the human answers, the answer returns

`form.ask({title, fields})` stores a form, opens `/form/:id` in the right pane,
and returns immediately. When the user submits, `POST /form/:id` records the
answer, renders it back — and calls `agent.prompt` with the submitted values, so
the answer lands in the ACP session as a chat message. The agent does not poll
and does not parse prose: it asks with a real form and continues from structured
data. This is the round trip that makes the left and right halves of the screen
one system.

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

# procs — how to work in this codebase

Read this before writing a line. It is short on purpose; the framework is small
and most of it is one idea repeated.

The one idea: **a file on disk is a function in a live process.** Drop a file,
it appears as `ctx.fns.<namespace>.<name>`. Change it, sync it, the running
server has the new version — the process is never restarted. Everything else
here follows from that.

## Running it

```sh
bun src/$main.ts                            # port from PORT, default 3000
bun script/repl.ts '<code>'                 # evaluate inside the live process
bun test                                    # co-located *.test.ts
```

The port of a running server is in `.runtime/port`; `script/repl.ts` finds it
there. The workspace we develop against runs on **51837** over
`WORKDIR=~/workspace-template-test`.

## The shape of every file

```ts
// One sentence on WHY this exists — not what the code plainly says.
export default async function (ctx: Context, session: Session | null, opts: { thing: string }) {
    const other = await ctx.fns.someNamespace.someFn({ ... });
    return { ... };
}
```

- **One function per file.** The file name is the function name;
  `src/services/start.ts` → `ctx.fns.services.start`.
- **Call, never import.** Project functions reach each other only through
  `ctx.fns` — that is what makes any of them hot-swappable. npm packages and
  `node:`/`bun:` builtins are imported normally.
- **Callers pass only opts.** `ctx` and `session` are injected by the proxy, so
  `ctx.fns.services.start({ name: "app" })` is the whole call.
- **State lives on `ctx.state`**, typed by a `$state_<key>.ts` file.
- **Names are verbs** (`startPrompt`, `resolveCommand`), except UI helpers,
  which are named after what they render (`chat.transcript`, `services.card`).

## File names carry meaning

| File | Becomes |
|---|---|
| `mod/name.ts` | `ctx.fns.mod.name` |
| `$name.ts` (in `src/`) | a root fn: `ctx.name` (e.g. `ctx.layout`) |
| `mod/$type_Name.ts` | the global type `types.mod.Name` |
| `mod/$state_key.ts` | types `ctx.state.key` |
| `mod/$route_<path>_<METHOD>.ts` | an HTTP route; `_`→`/`, `$id`→`:id` |
| `mod/$middleware[_path].ts` | runs before handlers under that prefix |
| `mod/$config.ts` | the module's config schema; env enters **only** here |
| `mod/$start.ts` / `$stop.ts` | lifecycle, ordered by `package.json` `proc.prod` |
| `mod/$hook_<name>.ts` | an extension point, run via `ctx.fns.hooks.run/first` |
| `mod/$migration_<id>.ts` | a db migration, applied in id order |
| `mod/client.js` + `$route_client.js_GET.ts` | a browser bundle, text-imported |

Two lint rules are enforced (`ctx.fns.dev.lint({})`): every segment must be a
valid identifier, and a name is **either** a function **or** a namespace —
`chat.ts` beside `chat/` is rejected. That is why the chat UI lives in
`src/chat/` while the agent keeps `src/agent/`.

## The loop you actually work in

Write the file with your editor, then load it into the running process:

```sh
bun script/repl.ts 'await ctx.fns.dev.sync({ rel: "services/start.ts" })'
bun script/repl.ts 'await ctx.fns.services.status({})'          # verify immediately
```

`dev.sync` figures out from the file name what it is (fn → reload + regenerate
types, route → reload routes, type → regenerate types). For small functions
`dev.def` writes and loads in one call.

**Reloading routes or a root `$fn.ts` needs the root ctx.** A REPL eval runs two
prototypes below it, and `loadRoutes` assigns `ctx.routes` on the object it is
called on:

```sh
bun script/repl.ts 'let root = ctx; while (Object.getPrototypeOf(root) !== Object.prototype) root = Object.getPrototypeOf(root);
await root.loadFns({}); await root.genTypes({}); await root.fns.http.loadRoutes({})'
```

A restart is only needed for `$main.ts`, `http/$start.ts` and `dev/watch.ts` —
they live as running closures.

## Types

`ctx_ns.d.ts` is generated: `ctx.genTypes({})` scans the project and writes the
typed registry, so `ctx.fns.*` autocompletes and `tsc` checks call shapes. The
runtime only strips types, so **the REPL will happily run code that does not
typecheck** — run `bunx tsc --noEmit` (or `ctx.fns.dev.typecheck({filter})`)
before you believe a change.

If `tsc` reports dozens of "property does not exist on ctx.fns", the registry is
stale — regenerate it rather than chasing the errors.

## HTTP

A handler returns whatever is convenient: a `Response` passes through, a string
becomes a page through `ctx.layout`, `{ main, title }` likewise, anything else
becomes JSON. `toResponse` also honours htmx: with an `HX-Request` header it
returns just `main` plus the out-of-band islands, which is how the right pane
swaps without reloading the page.

Test routes without a socket: `ctx.fns.http.dispatch({ url: "/processes" })`.

## Persistence

`ctx.fns.db.*` wraps `bun:sqlite` (synchronous — no promise juggling):
`query`, `run`, `exec`, plus a small query DSL (`sql`, `q`, `insert`). Schema
changes go in `$migration_<id>.ts`; `migrate` runs pending ones at boot.

Store a record as JSON in one column when the shape is a view-model
(`agent_messages.message`), and give columns only to what you order or join by.
That is a deliberate house pattern — it is why the transcript never needed a
second migration.

## The browser

htmx does swaps; vanilla JS covers what htmx cannot (autoscroll, autosize,
menus). The rules, in order of how often they are broken:

1. **No JS inside fragment files.** Behaviour goes in a `client.js` served by a
   text-import route, exposed as one global object.
2. **State flows in as arguments.** `hx-on--load="if (event.target === this)
   window.chat.compose(this)"`, `hx-on:click="window.chat.copy(this, {…})"` —
   never `querySelector`/`getElementById`/`data-*` to recover something the
   server already knew.
3. **Give every self-refreshing element an explicit `hx-target`.** htmx
   attributes are inherited: the right pane sets `hx-boost="true"
   hx-target="#main" hx-swap="innerHTML"`, so a child with its own `hx-get` and
   no target of its own swaps **the whole pane**. This cost an evening: the
   service list polled every five seconds and each tick replaced `#main` with
   just the list, taking the log pane with it, and after leaving the tab the
   timer kept firing at a target that no longer existed (`htmx:targetError`).
   Refresh contents, not the container — `hx-target="this" hx-swap="innerHTML"`
   keeps the element, its scroll position and its timer alive.
4. **Address elements by `data-*` convention**, not CSS selectors:
   `data-form`, `data-action`, `data-entity` + `data-id`. `ctx.fns.page.*` drives
   the open tab this way, so a restyle cannot break the agent.

Server pushes are one dumb bell: `ctx.fns.events.emit({ event: { type: "agent" } })`.
The client refetches the fragment; nothing about the payload travels.

## Plugins

A directory with `atomic-workspace.json` is a plugin, and a plugin is a skill
directory: the workspace's own live in `plugins/`, the project's in
`WORKDIR/.claude/skills/`. Inside, it is ordinary procs code — same file names,
same `ctx.fns`.

What it *is* comes from what it ships: functions are a library, a
`GET /<namespace>` route is a tab, a `SKILL.md` is a skill the coding agent
finds by itself, a `$hook_service.<x>.ts` provides that service, and
`"preview": { "files": "$qr_*.json", "fn": "preview" }` in the manifest makes it
the viewer for those files in the file manager. `"optional": true` keeps it in
the catalogue until `workspace.json` names it.

`docs/plugins.md` is the guide. See `plugins/filemanager` for the smallest
complete example, `plugins/aidbox` for a service provider, and
`plugins/questionnaire` for one wearing every face at once.

## Tests

Co-located, `bun test`. `testCtx()` gives a loaded ctx in test mode with no
server; `ctx.fns.http.dispatch` exercises routes in-process. `X.test.ts` tests
`X` — unit if `X.ts` is a function, functional if `X/` is a namespace.

## Where things are

| | |
|---|---|
| the framework | `src/{project,loadFns,genTypes,http,repl,dev,env,config,lifecycle,events,db,log}` |
| the workspace | `src/services` (supervisor), `src/agent` (ACP agent), `src/chat` (the chat column), `src/page` (driving the open tab) |
| the tabs | `plugins/{filemanager,preview,processes,form,aidbox}` |
| the design docs | `ARCHITECTURE.md`, `docs/agent.md`, `docs/services.md` |

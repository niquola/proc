# procs — file-based FP framework on Bun

A minimal procedural (FP-style) framework: functions on disk → `ctx.fns` registry at runtime. The file name determines what a file is (function, route, type, script). No imports between modules — everything is called through `ctx`. The live server is modified through the REPL and hot-reload, never restarted.

Extracted from `~/workspaces-template` and `~/hyper-code2` (core only: registry + web + REPL + generators, no domain modules).

## Running

```sh
bun src/$main.ts            # or: bun start; port from env PORT (default 3000)
bun script/repl.ts '<code>' # eval code inside the live server process
```

The running server's port is written to `.runtime/port` — `script/repl.ts` finds the server through it.

## Core idea: unified signature + implicit injection

**Every** project function is declared with the same signature:

```ts
export default async function (ctx: Context, session: Session | null, opts: {...}) { ... }
```

and is **called** through `ctx.fns.*` with opts only — `ctx` and `session` are injected automatically:

```ts
ctx.fns.notes.add({ text: "hi" })      // → rawAdd(ctx, ctx.session, { text: "hi" })
ctx.genTypes({})                        // root functions work the same way
```

Mechanics (src/$main.ts `makeCtx`):
- raw functions live in the `ctx.state.registry` tree
- `ctx.fns` is a getter returning a Proxy: accessing a function yields a wrapper `(opts) => raw(ctx, ctx.session, opts)`; the getter uses `this`, so the injected ctx is **the one you accessed through**
- root `$name.ts` functions are injecting getter properties directly on ctx (`defineRootFn` in loadFns.ts)
- per HTTP request: `rctx = Object.create(rootCtx)` + `rctx.session = { kind:'http', req, params, url }` → everything the handler calls via `rctx.fns.*` gets this session **through the whole call chain** with no manual threading
- REPL works the same: `session.kind === 'http'` (the POST /repl request) and onward down the chain

```ts
// src/$type_Context.ts
type Context = RootFns & {
    env: Record<string, string | undefined>;  // env vars
    state: Record<string, any>;               // registry, runtime singletons
    routes: Record<string, Record<string, Function>>; // path → method → handler
    session: Session | null;                  // current session (null on root ctx)
    fns: FnsRegistry;                          // injecting Proxy over state.registry
};
// src/$type_Session.ts
type Session = { req?: Request; params?: Record<string,string>; kind?: string; [k: string]: any };
```

HTTP handlers share the signature: `(ctx, session, opts: { req, params })`. The server calls them explicitly with a request-ctx; `session.req`/`session.params` are duplicated in opts for convenience.

`Context`, `Session`, `FnsRegistry`, `RootFns` are global types — no imports needed. Inside a function, call neighbors via `ctx.fns.x.y({...})` — don't pass the session, it flows by itself. Explicit raw arguments are only needed on direct imports (bootstrap in loadFns/scan).

## File-name conventions (src/project/classify.ts)

| File | What it is | Registered as |
|---|---|---|
| `module/name.ts` | function | `ctx.fns.module.name` |
| `$name.ts` (in src/ root) | root function | `ctx.name` (e.g. `ctx.genTypes`, `ctx.layout`) |
| `$type_Name.ts` | TypeScript type | global `Name` (root) or `types.module.Name` |
| `module/$route_<path>_<METHOD>.ts` | HTTP route | `METHOD /module/<path>` |
| `module/$script_name.js\|.css` | browser asset | `GET /module/name.js` (bundled by Bun.build on request) |
| `*.test.ts`, `*.entry.ts`, `*.d.ts`, `$main.ts` | skipped | — |

Route path rules: `_` in the name → `/` in the path; `$id` → `:id` (param). Examples:
- `src/repl/$route__POST.ts` → `POST /repl`
- `src/$route__GET.ts` → `GET /`
- `src/todo/$route_$id_edit_GET.ts` → `GET /todo/:id/edit`

Every function file is `export default async function (ctx: Context, session: Session | null, opts) {...}`. One file = one function. No side-effect imports.

Directories `_runtime`, `_test_*`, `_tmp_*`, `tmp_*` are ignored by the scanner.

## Core (boot sequence, src/$main.ts)

1. `makeCtx()` ($main.ts) — ctx with `state.registry` and the injecting Proxy getter `fns`
2. `loadFns` — `project/scan` globs `src/`, `classify` parses names, every `kind: fn` goes into `ctx.state.registry` (root fns as getters on ctx)
3. `ctx.genTypes({})` — regenerates `src/ctx_ns.d.ts`: `FnsRegistry`/`RootFns`, each entry wrapped in `Injected<typeof import(...).default>` — the type without (ctx, session), matching the actual call shape
4. `ctx.fns.http.loadRoutes({})` — registers `$route_*` and `$script_*` into `ctx.routes`
5. `ctx.fns.http.start({})` — `Bun.serve`, writes the port to `.runtime/port`, request log to `.runtime/http.log`
6. `ctx.fns.dev.watch({})` — file watcher on `src/` (opt-in `WATCH=1`, see below)

`ctx_ns.d.ts` is auto-generated — never edit by hand.

## Working with types

Four layers:

1. **Declaration**: `$type_Name.ts` with `export type Name = {...}`. In the `src/` root → a global type (`Context`, `Session`); in a module → `types.<module>.<Name>` (also global, no imports):
```ts
// src/notes/$type_Note.ts
export type Note = { id: number; text: string; at: string };
// in any function:
const note: types.notes.Note = ...;
```
2. **Generation** (`ctx.genTypes({})`): scans the project → writes `src/ctx_ns.d.ts` — typed `FnsRegistry`/`RootFns` (each fn as `Injected<typeof import(...)>` — without ctx/session, matching the real call) + the `types` namespace. Called automatically by `dev.def`/`dev.sync`/watcher — rarely needed by hand.
3. **IDE**: thanks to ctx_ns.d.ts you get full autocomplete for `ctx.fns.*` and opts parameters.
4. **Checking** (`ctx.fns.dev.typecheck({ filter? })`): `tsc --noEmit` from the REPL → `{ ok, errors: ["file(line,col): error TS..."] }`. **Important**: the runtime (Bun.Transpiler) only STRIPS types — `def`/`sync` catch syntax errors but NOT type errors. After writing typed code, call typecheck:
```sh
bun script/repl.ts 'await ctx.fns.dev.def({...}); ctx.fns.dev.typecheck({ filter: "notes/" })'
```

Limitation: code executed in the REPL buffer is never typechecked (only transpiled). Types are checked only for code in files.

## HTTP (src/http/)

- `match.ts` — path matcher: exact match first, then segment-by-segment with `:param`
- Handler signature: `(ctx, session, opts: { req, params }) => ...`
- Response auto-wrapping (http/$start.ts → toResponse):
  - `Response` → passthrough
  - `string` → HTML via `ctx.layout({ main })`
  - `{ main, title?, status? }` → HTML via layout
  - anything else → JSON
- `$layout.ts` — HTML shell (Tailwind CDN + htmx + `/events/client.js`)

## REPL (src/repl/)

Jupyter-style eval inside the live server process:

- `eval.ts` — code is the body of `async () => {...}`; TS is transpiled by `Bun.Transpiler`; in scope: `ctx` (request-scoped, with session), `session`, `console` (captured into a buffer), `print`. **The last expression is returned as a value** (`withLastExpressionReturn`). Result: `{ output, return }`
- `$route__POST.ts` — `POST /repl`, body = code. **Loopback only**; `NODE_ENV=production` → 403
- `load.ts` — hot-reload: `ctx.fns.repl.load({ name: "module.fn" })` (one function) or `{ name: "module" }` (whole module). Re-import with cache-bust `?t=Date.now()`, replaced in place
- `script/repl.ts` — CLI client: argument / `-f file` / stdin

## dev.def — the primary way to add code (src/dev/def.ts)

Synchronous: write file + load + genTypes **in one call**. Broken code → immediate throw, the broken file is not even written to disk (transpiler validation before writing). No races, no sleeps:

```ts
await ctx.fns.dev.def({ name: "math.fib", code: "export default async function (ctx: Context, session: Session | null, opts: {n: number}) {...}" });
await ctx.fns.dev.def({ rel: "math/$route__GET.ts", code: "..." });  // route/script — by rel path
```

The agent pattern — **def + verification in one REPL round-trip**:
```sh
bun script/repl.ts -f /dev/stdin <<'EOF'
await ctx.fns.dev.def({ name: "math.fib", code: `...` });
ctx.fns.math.fib({ n: 30 })
EOF
```
The response is either `return` with the verification result (everything loaded) or `error` (nothing registered). There is no third state.

## Watcher (src/dev/watch.ts) — opt-in, for editor-driven changes

`WATCH=1 bun src/$main.ts` — the server watches `src/`: **save a file → it's live**. Off by default (the agent's primary path is `dev.def`; the watcher is async — there is a race between writing and loading):

- `fn` → hot-load into `ctx.fns` + genTypes + tab reload
- `$route_*` / `$script_*` → loadRoutes + tab reload
- `$type_*` → genTypes
- a new directory with files → rescanned (FSEvents collapses such events)
- `.d.ts` ignored (genTypes output — would loop)

Error semantics: a broken file (syntax etc.) → `[watch] <file>: <error>` in the log, **the old version keeps running**; fix it → picked up. A handler error → 500 with stack (dev), the server lives. A REPL error → `{ error, stack }` in the response.

**watchErrors in the REPL**: while at least one watched file fails to load, EVERY `/repl` response carries `watchErrors: { "<rel>": "<error>" }` (the error board in `ctx.state.dev.errors`; cleared on successful load/file deletion). Protects against silent failure in watcher workflows: the function answers with the old version, but `watchErrors` shouts that the new code didn't load.

Manual reload (`ctx.fns.repl.load`, `ctx.fns.http.loadRoutes`) remains as a fallback. Editing `dev/watch.ts`, `http/$start.ts` or `$main.ts` itself requires a process restart (they live as running closures).

Typical dev cycle:
```sh
# created/edited any file in src/ → watcher did everything; verify immediately:
bun script/repl.ts 'ctx.fns.foo.bar({...})'
```

## Events / SSE (src/events/)

In-process pub/sub + a stream to the browser:

- `subscribe.ts` / `emit.ts` — a `Set` of subscribers in `ctx.state.events`; an event is `{ type: string, ... }`
- `$route__GET.ts` — `GET /events`, SSE stream (hello with `serverStart`, keepalive ping 25s)
- `client.js` — browser client (loaded by the layout): reconnect with backoff, `type: "reload"` → `location.reload()`, server restart (via `serverStart`) → reload, other events → DOM `CustomEvent('hyper-events')`
- `reload.ts` — `ctx.fns.events.reload({})` reloads all open tabs

## Generators (src/generate/)

Scaffolding with immediate registration (no restart):

- `fn.ts` — `ctx.fns.generate.fn({ module, name, body? })` → writes `src/<module>/<name>.ts`, hot-load, genTypes
- `route.ts` — `ctx.fns.generate.route({ module, path?, method, body? })` → writes `$route_*`, loadRoutes, broadcast reload
- `module.ts` — `ctx.fns.generate.module({ name })` → a `list` fn + an index route

## How to add code (agent workflow)

Two paths, pick by code size:

**1. Substantial code (Write tool available)** — preferred:
```sh
# Write src/<module>/<file>.ts (a regular file, no escaping), then:
bun script/repl.ts 'await ctx.fns.dev.sync({ rel: "<module>/<file>.ts" }); ctx.fns.<module>.<fn>({...})'
```
`dev.sync(rel)` figures out from classify what the file is (fn → repl.load + genTypes, route → loadRoutes, type → genTypes). Pros: no escaping, error stacks point to the real file:line.

**2. Small functions / iterations** — `dev.def` + verification in one round-trip (see the dev.def section). Con: inside `code: \`...\`` you must escape nested \` and \${ — for code with HTML templates this gets painful fast, use path 1.

Battle-tested: state functions via `ctx.state` persist between calls; forms (`req.formData()` + `Response.redirect`) work; `def`/`sync` can be defined through themselves.

Rules:
- Don't import project functions from each other — only calls via `ctx.fns`. External libs and `node:` modules are fine to import
- Deleted a file — the function stays in memory until restart (but leaves the types)
- Editing `dev/watch.ts`, `http/$start.ts`, `$main.ts` requires a process restart
- Server not running? `bun src/$main.ts` (check/set the port via `PORT`, find it in `.runtime/port`)

## Bun

The runtime is Bun (not Node): `bun <file>`, `bun test`, `bun install`, `Bun.serve`, `Bun.file`, `bun:sqlite`, `Bun.sql`, `Bun.$`. `.env` is loaded automatically. WebSocket is built in. Don't use express/vite/jest/pg/ws — Bun has it all built in.

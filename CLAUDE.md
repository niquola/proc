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

## Architecture

The whole system is one object — `ctx` — and a pipeline that fills it from the filesystem.

```
              DISCOVER                      REGISTER                    SERVE / RUN
  roots ──► scan ──► classify ──┬─► loadFns ──► ctx.state.registry ◄── ctx.fns (Proxy, injects ctx+session)
  (src + plugins)   (name→kind) ├─► genTypes ─► ctx_ns.d.ts (types)
                                ├─► loadRoutes ► ctx.routes ◄────────── http.$start (Bun.serve) / http.dispatch
                                └─► lint (guard: identifiers, no fn↔ns collision)
```

**`ctx` is the spine.** One shape, threaded everywhere:
- `ctx.state` — per-ctx world: `registry` (the raw fn tree), `db`, `events` subs, `server`, `dev.errors`, app/plugin state.
- `ctx.routes` — `path → method → handler`.
- `ctx.env` / `ctx.session` — environment vars and the current request/eval session.
- `ctx.fns` — an injecting **Proxy** over `ctx.state.registry`: reading `ctx.fns.a.b` and calling it runs `rawB(ctx, ctx.session, opts)`. Root `$name.ts` fns are injecting getters directly on `ctx`. The getter reads `this`, so any **derived** ctx (`Object.create` + own session/env/state) injects itself — this single mechanism powers request sessions, REPL eval, and `env.fork`.

**Discovery is uniform.** `roots` returns `src/` (namespace `""`) plus each plugin's dir (namespace from its manifest). `scan` globs every root and, for plugins, prefixes the namespace onto the path before `classify` (keeping `abs` at the real file). So plugins, the app, types, routes, and the build all flow through the *same* entries — there is no special plugin code path.

**Two lifecycles:**
- *A request* (http/$start.ts): `Bun.serve` → `http.match` → `makeRequestCtx(ctx, session{req,params})` → handler → `http.toResponse` (string→HTML via `ctx.layout`, object→JSON). `http.dispatch` is the same minus the socket (used by tests / sub-requests).
- *A code change* (dev): write a file → `dev.def`/`dev.sync` → `repl.load` re-imports it (cache-busted) and `setPath`s it into the live `registry` → `genTypes` + `loadRoutes` → SSE reloads browser tabs. **The process never restarts**; the running image is edited in place.

**Dev vs prod is discovery, frozen.** Dev fills the registry at runtime via dynamic `import(abs+'?t=…')` (un-bundleable → hot-reload). `dev.build` runs the *same* scan but emits a **static** import manifest, which `Bun.build` collapses into one self-contained `dist/app.js` — no scan, no dynamic import, dev tooling (watch/repl/genTypes) gone, `/repl` gated to 403.

**Layers** (each a `ctx.fns.<ns>`): `project` (discover) · core `loadFns`/`genTypes` (register/type) · `http` (serve/match/dispatch/wrap) · `repl` (eval/hot-reload) · `dev` (def/sync/lint/typecheck/build/manifest/watch/test) · `env` (mode/pick/fork) · `config` (typed/validated) · `lifecycle` (start/stop) · `events` (SSE) · `generate` (scaffold) · `plugins` (mount) · `db` (persistence). **Apps live in `examples/` as plugins** (`hello`, `todo`) — out of core; they call down through `ctx.fns` and **never import each other**, which is what keeps everything hot-swappable and bundleable.

## File-name conventions (src/project/classify.ts)

| File | What it is | Registered as |
|---|---|---|
| `module/name.ts` | function | `ctx.fns.module.name` |
| `$name.ts` (in src/ root) | root function | `ctx.name` (e.g. `ctx.genTypes`, `ctx.layout`) |
| `$type_Name.ts` | TypeScript type | global `Name` (root) or `types.module.Name` |
| `module/$route_<path>_<METHOD>.ts` | HTTP route | `METHOD /module/<path>` |
| `module/$middleware[_<path>].ts` | middleware | runs before handlers under `/module[/<path>]/*` |
| `module/$state_<key>.ts` | typed state slot | types `ctx.state.<key>` (file exports `type <key>`) |
| `module/$start.ts` / `$stop.ts` | lifecycle hooks | run at boot / shutdown (`ctx.fns.lifecycle.*`) |
| `module/$config.ts` | config schema | validated config via `ctx.fns.config.resolve({module})` |
| `module/$script_name.js\|.css` | browser asset | `GET /module/name.js` (bundled by Bun.build on request) |
| `*.test.ts`, `*.entry.ts`, `*.d.ts`, `$main.ts` | skipped | — |

Route path rules: `_` in the name → `/` in the path; `$id` → `:id` (param). Examples:
- `src/repl/$route__POST.ts` → `POST /repl`
- `src/$route__GET.ts` → `GET /`
- `src/todo/$route_$id_edit_GET.ts` → `GET /todo/:id/edit`

Every function file is `export default async function (ctx: Context, session: Session | null, opts) {...}`. One file = one function. No side-effect imports.

Directories `_runtime`, `_test_*`, `_tmp_*`, `tmp_*` are ignored by the scanner.

## Nested namespaces & the lint (src/dev/lint.ts)

Directories nest the registry to any depth: `src/billing/invoices/create.ts` → `ctx.fns.billing.invoices.create`. The same nesting flows through runtime (loadFns + the injecting Proxy), types (genTypes emits nested interface bodies + nested `namespace` blocks), and the build (manifest emits a nested literal) — kept in sync because all three walk the moduleDir segments the same way.

Two rules are **enforced by `ctx.fns.dev.lint({})`** (gated in `dev.def`/`dev.sync`/`dev.build`, and checked at boot):

1. **Every segment / function name / type name is a valid JS identifier** (`/^[A-Za-z_$][\w$]*$/`). Dashes/dots/spaces break the generated `ctx_ns.d.ts` (and dots corrupt the build manifest's dotted-key tree). A reserved word like `delete` is fine (valid as a member name). Route *paths* may contain dots (`$route_client.js_GET.ts` → `/events/client.js`) — those are string keys, not registry nesting, so they're allowed.
2. **A name is either a function or a namespace, never both.** `src/x/cart.ts` (a fn) beside `src/x/cart/…` (a namespace) is forbidden: at runtime the injecting Proxy wraps the function and drops the nested fns; the build silently loses them; genTypes emits a duplicate member. Callable-namespaces can't coexist with the Proxy, so the collision is rejected — rename one.

`dev.def`/`dev.sync` throw with the lint errors (def also rolls back the file it just wrote); `dev.build` aborts so a broken bundle never ships; boot logs `[lint] ✗ …` but keeps running so you can fix via the REPL. genTypes also defensively quotes non-identifier member keys so one stray hand-edited file can't nuke the whole `ctx_ns.d.ts` before you see the lint.

## Core (boot sequence, src/$main.ts)

1. `makeCtx()` ($main.ts) — ctx with `state.registry` and the injecting Proxy getter `fns`
2. `loadFns` — `project/scan` globs `src/`, `classify` parses names, every `kind: fn` goes into `ctx.state.registry` (root fns as getters on ctx)
3. `ctx.genTypes({})` — regenerates `src/ctx_ns.d.ts`: `FnsRegistry`/`RootFns`, each entry wrapped in `Injected<typeof import(...).default>` — the type without (ctx, session), matching the actual call shape
4. `ctx.fns.http.loadRoutes({})` — registers `$route_*` and `$script_*` into `ctx.routes`
5. `ctx.fns.http.start({})` — `Bun.serve`, writes the port to `.runtime/port`, request log to `.runtime/http.log`
6. `ctx.fns.dev.watch({})` — file watcher on `src/` (opt-in `WATCH=1`, see below)

`ctx_ns.d.ts` is auto-generated — never edit by hand.

## Plugins (src/plugins/, PLUGINS.md)

A plugin is a package (local dir / npm / git) with a `proc` field in its `package.json` (`{ namespace, src }`) and a `src/` tree of normal proc functions. Declared in the **host** `package.json` `proc.plugins: [{ from }]` (`from` = a `bun add` spec). `project/roots.ts` resolves each plugin's dir and `project/scan.ts` prefixes its namespace onto each file's path before `classify` (keeping `abs` at the real file) — so plugin code merges into the **one shared `ctx.fns`** under its namespace (`auth/login.ts` → `ctx.fns.auth.login`, route → `GET /auth/...`) and flows through loadFns / genTypes / lint / loadRoutes / manifest+build unchanged. `genTypes` and `dev.manifest` import by path relative to `entry.abs`, so plugin files outside `src/` are typed and bundled into the single `dist/app.js`. `dev.lint` guards namespace collisions across plugins. Surface: `ctx.fns.plugins.add({from})` (bun add → persist → remount, dev-only), `.list({})`, `.remove({from})`. Broken plugins are logged + skipped at boot. Example: `examples/hello`. Full guide in PLUGINS.md.

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

## Lifecycle & config (src/lifecycle/, src/config/) — adopted from context-clj

**Lifecycle** — a module's `$start.ts` `(ctx, config)` runs at boot; it may **return a state object** merged into `ctx.state.<module>` (and handed back to `$stop`). `$stop.ts` `(ctx, state)` tears down. Run by `ctx.fns.lifecycle.start/stop` in the order declared in **package.json `proc.prod`** (its keys are the system modules; started in key order, `http` last; `$stop` in reverse on SIGINT/SIGTERM). Idempotent; on a `$start` failure, already-started modules are stopped (rollback). The server and the db are themselves lifecycle modules: `http/$start.ts` (Bun.serve) + `http/$stop.ts`; `db/$start.ts` (connect) + `db/$stop.ts` (close). So boot is uniform: `loadFns → genTypes → loadRoutes → lifecycle.start`.

**Config** — `module/$config.ts` default-exports a `ConfigSchema` (`{ param: { type, required?, default?, env?, validator? } }`; types `string|string[]|integer|number|boolean|map`). A module reads its config via `ctx.fns.config.resolve({ module })` — **never importing `$config`** (schemas are collected into `ctx.state.configSchemas` at boot; the `ConfigOf<typeof import("./$config").default>` cast for the *type* is erased at runtime). **Env enters through config**: values resolve `defaults < package.json proc.prod.<module> < env` (env var `<MODULE>__<KEY>` or `schema.env`), are **coerced** (string→int/bool/array/map) and **validated** (required/type/custom) — invalid config throws, so a bad `$start` fails loudly. So modules read `ctx.fns.config.resolve`, not `ctx.env`.

```jsonc
// package.json — the system manifest: which modules + their config
"proc": { "prod": { "db": { "url": "data/dev.sqlite" }, "http": { "port": 47393 } }, "plugins": [ … ] }
```
`db/$config.ts` → `{ url: { type: "string", required: true, default: "data/dev.sqlite", env: "DATABASE_URL" } } as const satisfies ConfigSchema`. In prod `DATABASE_URL`/`PORT` env override; the schema is baked into the bundle.

## Middleware & typed state

**Middleware** — `$middleware[_<path>].ts` runs before a route handler when the request path is under its prefix. Bare `module/$middleware.ts` → prefix `/module`; the `_<path>` suffix extends it (`_`→`/`, `$id`→`:id` one-segment wildcard). They run **most-general-prefix first**, get `(ctx, session, opts{req,params})`, and:
- mutate the **session** to extend it — `session.user = …`, `session.tenant = …` — which then flows to the handler and everything it calls via `ctx.fns.*` (the session is on the request ctx);
- **short-circuit** by returning a `Response` (auth 401, redirect) — no handler runs.

Collected into `ctx.state.middleware` by `loadRoutes`, matched by `ctx.fns.http.middleware({pathname})`, run by both `http/$start` (server) and `http.dispatch` (tests). Plugin middleware is namespace-prefixed like its routes. Included in the prod bundle.

**Typed state** — `$state_<key>.ts` declares the *type* of `ctx.state.<key>` (the file exports `type <key>`). `genTypes` merges it into the global `CtxState` interface, so `ctx.state.<key>` is typed everywhere. The *value* is set at runtime (by a middleware, fn, or — see lifecycle — a `$start`). Example: `examples/hello/src/$state_hello.ts` + `$middleware.ts` (writes `session.via` and the typed `ctx.state.hello`).

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

## Production build (src/dev/build.ts, src/dev/manifest.ts)

Dev populates the registry at runtime via `scan()` + dynamic `import(abs + '?t=...')` — those imports are deliberately un-bundleable (that's what powers hot-reload). The build **freezes the discovered namespace into a static import graph** the bundler can follow, then `Bun.build` collapses every module + Bun-bundled deps into ONE self-contained file. Same registry shape both ways — only how it's populated differs.

```sh
bun script/repl.ts 'ctx.fns.dev.build({})'   # → dist/app.js (one file, ~23 KB)
bun dist/app.js                               # runs standalone: no src/, no node_modules
```

- `ctx.fns.dev.manifest({ out? })` — the build-time twin of loadFns/loadRoutes: walks `scan()` and emits `.runtime/build/manifest.ts` with a **static** `import` per fn/route + a `registry`/`rootFns`/`routeDefs` literal. (This is `genTypes` with a different emitter: **one scan, two emitters** — genTypes emits *types*, manifest emits *values*.)
- `ctx.fns.dev.build({ outdir? })` — runs manifest, writes a prod entry that does `makeCtx()` → assign the static `registry` → `defineRootFn` the root fns → wire `routeDefs` into `ctx.routes` → `http.start`, then `Bun.build({ entrypoints: [main], target: 'bun', minify: true })` → `dist/app.js`.

The bundle sets `NODE_ENV=production`, so the dev machinery is gone by construction: no scan, no dynamic import, no genTypes/watch at boot, and `/repl` returns 403. Fast cold start, single deployable artifact.

Current limits (Later): `$script_*` browser assets aren't pre-bundled into the artifact, and routes that read sibling files via `import.meta.dir` (e.g. `events/$route_client.js_GET.ts`) break in the bundle — inline such assets (Bun `with { type: "text" }`) or pre-build them. Types are stripped (a runtime concern they aren't).

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

## Testing (src/$test.ts, src/dev/test.ts)

Co-located `*.test.ts`, run with `bun test` (the scanner skips them, so they're never registered; `$test.ts` is reserved/skipped too). Two tiers, **same naming, one rule**: `X.test.ts` tests `X` — and because the lint guarantees a name is *either* a function *or* a namespace, never both, the target is unambiguous:

- **Unit** — `src/<path>/<fn>.test.ts` next to `<fn>.ts`. Tests one function. (e.g. `src/http/match.test.ts`, `src/dev/lint.test.ts`)
- **Functional** — `src/<ns>.test.ts` next to the `<ns>/` directory. Tests the namespace's functions working together — state, events, routes, multi-fn flows. (e.g. `src/project.test.ts`, `src/events.test.ts`)

The harness gives each test a real `ctx` with the full registry **and routes** loaded, `NODE_ENV=test`, and **no server** (`bun test` never opens a port):

```ts
import { test, expect } from "bun:test";
import { testCtx } from "../$test";       // ./$test from src/ root
const ctx = await testCtx();              // fresh ctx per call — no ctx.state leak between files
test("fib", async () => {
    expect(await ctx.fns.math.fib({ n: 10 })).toEqual({ n: 10, fib: 55 });
});
```

Call functions idiomatically through `ctx.fns.*` (injection works in tests too). Run from the REPL with `ctx.fns.dev.test({ filter? })` (spawns `bun test` in a separate process — symmetric with `dev.typecheck`); `filter` is bun test's path/name filter, so `dev.test({ filter: "billing" })` runs that namespace's unit + functional tests.

**Testing REST — no server.** `ctx.fns.http.dispatch({ method?, url, body?, headers? })` does an in-process HTTP call: matches the route, builds a request ctx+session, runs the handler, wraps the result via `ctx.fns.http.toResponse` (shared with the real server) → returns a `Response`. `body` object → JSON. Same path the server runs, minus the socket:

```ts
const res = await ctx.fns.http.dispatch({ method: "POST", url: "/issues/add", body: { title: "x" } });
expect(res.status).toBe(303);
expect(await (await ctx.fns.http.dispatch({ url: "/issues" })).json()).toEqual([...]);
```

A pure handler can also just be called directly; `dispatch` is preferred because it exercises the routing/wrapping too. `reqCtx(ctx, { params, req })` (from `$test`) builds a request ctx+session if you want to call a handler with a session but bypass routing.

## Environments (src/env/) — test · dev · prod, per-ctx

The environment is a property of the **ctx**, not the process — derived from `ctx.env.NODE_ENV` (`production`→`prod`, `test`→`test`, else `dev`). So a test environment can coexist with dev in one running process / REPL.

- `ctx.fns.env.mode()` → `"prod" | "test" | "dev"`.
- `ctx.fns.env.pick({ test?, dev?, prod? })` → the value for this ctx's mode (falls back test→dev→prod). The idiomatic way to vary config — a config fn is just a function: `// src/db/url.ts` → `export default (ctx) => ctx.fns.env.pick({ test: ":memory:", dev: "data/dev.sqlite", prod: ctx.env.DATABASE_URL })`.
- `ctx.fns.env.fork({ mode })` → a derived ctx that **shares the registry + routes (same code)** but has its **own env and own `state`** (own db connection, events, caches). This is what lets a test env live next to dev:

```ts
const t = ctx.fns.env.fork({ mode: "test" });   // in the live dev REPL
await t.fns.db.connect({});                       // test db (env.pick → :memory:), separate from dev's
const res = await t.fns.http.dispatch({ url: "/issues" });   // runs in the test env
// dev's ctx.state / db / mode are untouched
```

`testCtx()` sets `NODE_ENV=test`; the prod bundle sets `production`; `bun src/$main.ts` is dev. Mechanism: the `ctx.fns` Proxy injects the ctx you call through and reads `this.state.registry`, so a derived ctx (`Object.create` + own `env`/`state`, registry carried over) resolves the same functions but in its own world.

### Config & secrets — `.env` files

Bun auto-loads `.env` files at process start, selecting by the **process** `NODE_ENV`. `makeCtx` copies `process.env` into `ctx.env`, so whatever Bun loaded is on `ctx.env`:

| Run | process NODE_ENV | files Bun loads (later wins) |
|---|---|---|
| `bun test` | `test` (auto) | `.env`, `.env.test`, `.env.test.local` |
| `bun src/$main.ts` | unset → dev | `.env`, `.env.development`, `.env.local` |
| `NODE_ENV=production bun dist/app.js` | `production` | `.env`, `.env.production`, `.env.production.local` |

So **`.env.test` "just works" for `bun test`** — verified. Convention: commit non-secret defaults in `.env.development` / `.env.test`; keep secrets in `.env.local` / `.env.*.local` (gitignored; `.env` itself is gitignored too). `.env.local` is skipped under test.

Caveat: `.env` selection happens **at process start**, before our code runs, so a forked test env inside a dev process (`env.fork`) does NOT retroactively load `.env.test` — it inherits the dev process's vars. For per-ctx values that differ from the process env, use `ctx.fns.env.pick({...})` (config-by-function) or `env.fork({ mode, env: { KEY: "..." } })` to override specific vars on the forked ctx.

## Persistence — example db module (src/db/)

Not core, but the canonical example of env-aware, ctx-scoped state. A thin `bun:sqlite` layer whose **connection lives in `ctx.state.db`** (per-ctx, not a module global) — so `env.fork` gives each environment an isolated database:

- `db.url()` → `env.pick({ test: ":memory:", dev: "data/dev.sqlite", prod: ctx.env.DATABASE_URL })`
- `db.conn()` → lazily opens + caches the `Database` on `ctx.state.db`
- `db.query/run/exec/close` — thin helpers (positional `[..]` or named `{$x}` params)

`examples/todo/` is an example app (a plugin) on top of `db` — htmx + Tailwind UI (`migrate/add/list/toggle/remove/render` + `/todo` routes). Tested in-memory with no server (`examples/todo/src/todo.test.ts`, `src/db.test.ts`): `testCtx` sets `DATABASE_URL=:memory:` (env-through-config), and `env.fork` → two isolated connections proves the db is ctx-scoped.

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

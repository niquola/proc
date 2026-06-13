# proc

A tiny file-based, REPL-driven web framework for [Bun](https://bun.sh). Functions on disk become a live registry at runtime; the file name tells the framework what each file is; the running server is grown function-by-function through a REPL — never restarted.

Think *Clojure-style REPL-driven development*, but for TypeScript on Bun, with every definition persisted to a real file (so stack traces, git and your editor all keep working).

## Quick start

```sh
bun install
bun src/$main.ts                                # start the server (PORT env, default 3000)
bun script/repl.ts 'Object.keys(ctx.fns)'       # eval inside the live process
```

## The idea

**1. Files are the registry.** Drop a file — get a function. No imports, no wiring:

| File | Becomes |
|---|---|
| `src/notes/add.ts` | `ctx.fns.notes.add` |
| `src/$layout.ts` | `ctx.layout` (root function) |
| `src/notes/$type_Note.ts` | global type `types.notes.Note` |
| `src/notes/$route_$id_GET.ts` | `GET /notes/:id` |
| `src/ui/$script_app.js` | `GET /ui/app.js` (bundled on request) |

**2. One signature, implicit injection.** Every function is declared as

```ts
export default async function (ctx: Context, session: Session | null, opts: {...}) { ... }
```

and called with opts only — `ctx.fns` is a Proxy that injects `ctx` and the current `session`:

```ts
ctx.fns.notes.add({ text: "hi" })
```

Per HTTP request the framework derives a child ctx (`Object.create`) carrying `{ req, params, url }` — the session flows through the entire call chain with zero manual threading.

**3. The server is never restarted.** Code changes enter the live process through:

```ts
// write + load + typegen in ONE call; broken code throws and is never written:
await ctx.fns.dev.def({ name: "notes.add", code: "export default async function (...) {...}" })

// or: write the file with your editor, then sync it (fn / route / type — auto-detected):
await ctx.fns.dev.sync({ rel: "notes/add.ts" })

// or: opt-in file watcher (WATCH=1) — save a file and it's live
```

**4. Types are generated, not written.** `ctx.genTypes({})` scans the project and emits `src/ctx_ns.d.ts` — a fully typed `FnsRegistry` where each entry is `Injected<typeof import(...)>` (ctx/session stripped, matching the real call shape). You get IDE autocomplete and `tsc` checking across `ctx.fns.*` call sites, including return types. The runtime only strips types, so there is a REPL-callable checker:

```ts
ctx.fns.dev.typecheck({ filter: "notes/" })   // → { ok, errors: ["file(line,col): TS..."] }
```

## Architecture

The whole system is one object — `ctx` — filled from the filesystem by a uniform pipeline:

```
            DISCOVER                    REGISTER                  SERVE / RUN
 roots ─► scan ─► classify ─┬─► loadFns ──► ctx.state.registry ◄─ ctx.fns  (Proxy: injects ctx+session)
 (src + plugins) (name→kind) ├─► genTypes ─► ctx_ns.d.ts (types)
                            ├─► loadRoutes ► ctx.routes ◄──────── Bun.serve / http.dispatch
                            └─► lint        (identifiers, no fn↔namespace collision)
```

- **`ctx` is the spine.** `ctx.state` (registry, db, events, server, …), `ctx.routes`, `ctx.env`, `ctx.session`, and `ctx.fns` — an injecting Proxy over the registry. The Proxy reads `this`, so any derived ctx (`Object.create` + own session/env/state) injects itself; this one trick powers request sessions, REPL eval, and `env.fork` (a test env beside dev in one process).
- **Discovery is uniform.** Plugins are just extra roots with a namespace; `scan` prefixes it before `classify`, so app code, plugins, types, routes and the build all flow through the *same* entries — no special plugin path.
- **A request:** `Bun.serve` → `http.match` → request ctx (with session) → handler → `http.toResponse` (string→HTML, object→JSON). `http.dispatch` is the same, in-process, no socket — that's how REST is tested.
- **A code change:** write a file → `dev.def`/`dev.sync` re-imports it into the live registry → regenerate types + routes → SSE reloads tabs. **The process never restarts.**
- **Dev vs prod:** the same scan that fills the registry at runtime is, at build time, emitted as a static import graph and frozen by `Bun.build` into one file.

## The dev loop

```sh
bun script/repl.ts -f /dev/stdin <<'EOF'
await ctx.fns.dev.def({ name: "math.fib", code: `
export default async function (ctx: Context, _s: Session | null, opts: { n: number }) {
    let [a, b] = [0, 1];
    for (let i = 0; i < opts.n; i++) [a, b] = [b, a + b];
    return { n: opts.n, fib: a };
}
`});
ctx.fns.math.fib({ n: 30 })
EOF
# → { "success": true, "return": { "n": 30, "fib": 832040 } }
```

One round-trip: define → registered → tested. The response is either the result or an error — there is no half-registered state.

This loop is designed for AI agents as much as for humans: an agent talks to the live system through `POST /repl` (loopback-only, disabled in production), defines functions, inspects state, runs typecheck — all without touching a terminal beyond one curl.

## Production build

Dev discovers the registry at runtime (scan + dynamic import — un-bundleable, which is what powers hot-reload). The build freezes that discovered namespace into a static import manifest, then `Bun.build` collapses everything into one self-contained file:

```sh
bun script/repl.ts 'ctx.fns.dev.build({})'   # → dist/app.js (~23 KB)
bun dist/app.js                               # standalone: no src/, no node_modules, no scan
```

The bundle runs in `NODE_ENV=production` — dev machinery (scan/watch/genTypes) is gone and `/repl` is 403. Same registry, frozen. (One scan, two emitters: `genTypes` emits *types*, `dev.manifest` emits *values*.)

## What's inside

```
src/
├── $main.ts            # boot: makeCtx (injecting Proxy) → loadFns → genTypes → routes → serve
├── $layout.ts          # HTML shell (Tailwind + htmx + SSE client)
├── $type_Context.ts    # global Context / CtxState   ($type_Session.ts: Session)
├── ctx_ns.d.ts         # AUTO-GENERATED typed registry
├── loadFns.ts          # register fns into ctx.state.registry (setPath, defineRootFn)
├── genTypes.ts         # scan → ctx_ns.d.ts (typed FnsRegistry, nested namespaces)
├── project/            # roots (src + plugins) · scan · classify (file-name conventions)
├── http/               # Bun.serve · match (:params) · dispatch (in-process) · toResponse
├── repl/               # eval (last expression = value) · hot-reload · POST /repl
├── dev/                # def · sync · lint · typecheck · test · watch · manifest + build
├── env/                # mode · pick · fork (per-ctx test/dev/prod, coexisting)
├── events/             # SSE pub/sub, browser auto-reload
├── plugins/            # add / list / remove — mount packages into ctx.fns (see PLUGINS.md)
├── generate/           # fn / route / module scaffolding
├── lifecycle/          # $start / $stop module hooks, ordered by package.json proc.prod
├── config/             # coerce · validate · resolve (typed config, env-through-config)
├── hooks/              # named extension points ($hook_<name>): register · run · first
├── migrate/            # db migrations ($migration_<id>): up · down · status
├── cli/                # CLI runner ($cli_<command>): parse · run · list (script/cli.ts)
├── db/                 # persistence: bun:sqlite + query DSL (sql · q · insert)
└── $test.ts            # test harness: testCtx() gives a loaded ctx, no server

examples/               # apps, kept out of core
├── hello/              # plugin: fn + route + $middleware + $state + $hook + $migration
└── todo/               # standalone app (boot from its own folder): htmx + Tailwind on db
```

~1900 lines of framework, zero runtime dependencies beyond Bun itself.

Handlers return whatever is convenient: a `Response` passes through, a `string` becomes an HTML page via the layout, `{ main, title }` likewise, anything else becomes JSON.

## Conventions

- Route files: `$route_<path>_<METHOD>.ts`, `_` → `/`, `$id` → `:id`. So `src/todo/$route_$id_edit_GET.ts` → `GET /todo/:id/edit`.
- Directories nest to any depth: `src/billing/invoices/create.ts` → `ctx.fns.billing.invoices.create`, consistently across runtime, types, and the build.
- `module/$middleware[_<path>].ts` runs before handlers under `/module[/<path>]/*` — mutate `session` to extend it, or return a `Response` to short-circuit. `module/$state_<key>.ts` types `ctx.state.<key>`.
- `ctx.fns.dev.lint({})` (gated in def/sync/build/boot) forbids the two ways nesting silently breaks: non-identifier names, and a name being both a function and a namespace (`x.ts` beside `x/`).
- Tests are co-located `*.test.ts` (`bun test`): `X.test.ts` tests `X` — unit if `X.ts` is a function, functional if `X/` is a namespace. `testCtx()` gives a loaded `ctx` (test mode, no server); `ctx.fns.http.dispatch({url})` tests REST in-process.
- Environments are per-ctx (`ctx.fns.env.mode/pick`): `ctx.fns.env.fork({ mode: "test" })` spins a test env — own state + db, shared code — coexisting with dev in one process.
- Modules can have `$start.ts` / `$stop.ts` (lifecycle), `$config.ts` (typed, validated config — env enters *through* config), `$hook_<name>.ts` (extension points), `$migration_<id>.ts` (db migrations), `$cli_<command>.ts` (CLI). The system manifest is package.json `proc.prod: { module: config }`. All hot-reload via `dev.def/sync`. See CLAUDE.md.
- Apps are plugins under `examples/` (declared in package.json `proc.plugins`). A plugin's namespace prefixes everything: `examples/todo` (namespace `todo`) serves `/todo/*` and `ctx.fns.todo.*`, calling core `ctx.fns.db` — no imports.
- Never import project functions from each other — call through `ctx.fns` (that's what makes everything hot-swappable).
- `ctx.state` holds runtime singletons and survives between REPL calls.
- Editing `$main.ts`, `http/$start.ts` or `dev/watch.ts` requires a restart — they live as running closures. Everything else hot-reloads.

The full framework guide (including the agent workflow) lives in [CLAUDE.md](CLAUDE.md).

## Origins

Extracted as a minimal core from two larger experiments: the registry/REPL/typegen machinery without any domain modules.

## License

MIT

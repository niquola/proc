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

## What's inside

```
src/
├── $main.ts            # boot: makeCtx (injecting Proxy) → loadFns → genTypes → routes → serve
├── $layout.ts          # HTML shell (Tailwind + htmx + SSE client)
├── $type_Context.ts    # global Context type
├── $type_Session.ts    # global Session type
├── ctx_ns.d.ts         # AUTO-GENERATED typed registry
├── project/            # scan + classify: file name conventions
├── http/               # Bun.serve, file-name routing, :params, response auto-wrapping
├── repl/               # eval (last expression = value), hot-reload, POST /repl
├── dev/                # def, sync, typecheck, watch (opt-in)
├── events/             # SSE pub/sub, browser auto-reload
└── generate/           # fn / route / module scaffolding
```

~1300 lines total, zero runtime dependencies beyond Bun itself.

Handlers return whatever is convenient: a `Response` passes through, a `string` becomes an HTML page via the layout, `{ main, title }` likewise, anything else becomes JSON.

## Conventions

- Route files: `$route_<path>_<METHOD>.ts`, `_` → `/`, `$id` → `:id`. So `src/todo/$route_$id_edit_GET.ts` → `GET /todo/:id/edit`.
- Never import project functions from each other — call through `ctx.fns` (that's what makes everything hot-swappable).
- `ctx.state` holds runtime singletons and survives between REPL calls.
- Editing `$main.ts`, `http/$start.ts` or `dev/watch.ts` requires a restart — they live as running closures. Everything else hot-reloads.

The full framework guide (including the agent workflow) lives in [CLAUDE.md](CLAUDE.md).

## Origins

Extracted as a minimal core from two larger experiments ([hyper-code](https://github.com/niquola) lineage): the registry/REPL/typegen machinery without any domain modules.

## License

MIT

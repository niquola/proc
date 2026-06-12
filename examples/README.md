# examples

Two ways to compose with proc, one example of each:

| Example | Shape | How it composes |
|---|---|---|
| [`hello/`](./hello) | **Plugin** | mounted *into a host* (declared in the host `package.json` `proc.plugins`). Namespace-prefixed: `ctx.fns.hello.*`, routes `/hello/*`. |
| [`todo/`](./todo) | **Standalone app** | boots proc *as a framework dependency*, runs from its own folder. htmx + Tailwind on `db`, with tests. |

## Plugin (`hello`)

A package with `proc: { namespace, src }` in its `package.json`; the host wires
it. Its namespace prefixes everything; it calls core (`ctx.fns.db`, `ctx.fns.env`)
through the shared `ctx.fns` — never importing. See [../PLUGINS.md](../PLUGINS.md).

## Standalone app (`todo`) — run from the app's own folder

```sh
cd examples/todo
bun index.ts          # → http://localhost:47480
```

`index.ts` is one line — `import { boot } from "proc"; await boot({ root: import.meta.dir })`.
`boot` scans **two roots**: the app's `src/` (its fns/routes, at the root
namespace) **+** proc's own core (http/repl/dev/config/lifecycle/…), merged into
one `ctx.fns`. The app **overrides** core defaults (its `GET /` home wins). The
project root — where `package.json` (`proc.prod` config), `src`, and the
generated `ctx_ns.d.ts` live — is the app's folder, so `db` writes
`examples/todo/data/todo.sqlite` and `http` listens on the app's configured port.

Tests boot the app's root explicitly: `testCtx({ root })` (in-memory db, no server).

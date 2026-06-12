# examples

Apps and demos as **plugins** — kept out of core. Each is a package with a `proc`
field in its `package.json` (`{ namespace, src }`); the host wires it via
`package.json` `proc.plugins`. A plugin's namespace prefixes everything it
contributes (`namespace: "todo"` → `ctx.fns.todo.*` and routes `/todo/*`), and it
calls core functions (`ctx.fns.db`, `ctx.fns.env`, …) through the shared `ctx.fns`
— never importing them. See [../PLUGINS.md](../PLUGINS.md).

| Plugin | What it shows |
|---|---|
| [`hello/`](./hello) | Minimal plugin: a fn, a route, a `$middleware` (writes the session), a typed `$state_` slot. |
| [`todo/`](./todo) | A real app: htmx + Tailwind UI on top of `db` (sqlite), with co-located tests (in-memory db, no server). |

Run them: they're already declared in the host `package.json`, so `bun src/$main.ts`
mounts them — open `/hello/ping` and `/todo`.

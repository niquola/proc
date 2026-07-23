# Services — the supervisor

The workspace runs the project's processes so a developer does not have to keep
four terminals open. It replaces `process-compose` for this job, and it is
deliberately smaller than one: a start gate, a crash policy, a log ring. No
monitoring, no scaling, no log files.

Everything below is `WORKDIR/workspace.json` and `src/services/*`.

## The manifest

The service **name is its type**: a bare declaration is a *request*, answered by
whichever plugin registered the `service.<name>` hook. Anything with `cmd` runs
as written; anything with `url` already exists and is only published.

```jsonc
{
  "env": { "NODE_ENV": "development" },      // base of the shared environment

  "services": {
    "aidbox": { "license": "…" },            // a request — plugins/aidbox answers it

    "temporal": {
      "cmd": "docker compose up temporal temporal-ui",
      "portEnv": ["TEMPORAL_PORT", "TEMPORAL_DB_PORT", "TEMPORAL_UI_PORT"],
      "publish": { "TEMPORAL_ADDRESS": "localhost:${TEMPORAL_PORT}" },
      "ready": { "tcp": true, "timeout": 120 }
    },

    "app": {
      "cmd": "bun run dev",
      "portEnv": "PORT",
      "urlEnv": "APP_URL",
      "needs": ["aidbox", "temporal"],
      "ready": { "http": "/" },
      "backoff": 2
    },

    "worker": {
      "cmd": "bun workflows/worker.ts",
      "needs": ["temporal"],
      "ready": { "log": "worker polling task queue" }
    }
  }
}
```

Note what is absent: no port numbers, no `.env` sourcing, no wait-for-it
scripts. Ports are assigned per run and interpolated where they are needed.

### Every key

| key | default | meaning |
|---|---|---|
| `cmd` | — | `string` → `sh -lc`, `string[]` → argv. Absent ⇒ provider hook (or `url`). |
| `url` | — | external service: nothing is started, the address is published. |
| `provider` | the service name | which `service.<x>` hook resolves this. |
| `dir` | `"."` | working directory, relative to `WORKDIR`. |
| `portEnv` | — | env var(s) given a free port; the first is the service's own. |
| `urlEnv` | — | env var given `http://localhost:<port>` (or `url`). |
| `env` | `{}` | **this service only** — a license, a database password. |
| `publish` | `{}` | merged into the **shared** environment everyone gets. |
| `needs` | `[]` | start after these are *ready*. |
| `ready` | `{tcp:true}` if it has a port, else `{}` | `{http:"/path"}` (any answer < 500), `{tcp:true}`, `{log:"substring"}`, or nothing = ready when spawned. `timeout` 60 s, `period` 0.5 s. |
| `restart` | `"on-failure"` | `never` · `on-failure` (non-zero exit only) · `always`. |
| `backoff` | `1` | seconds, doubled per consecutive restart, capped at 30. |
| `maxRestarts` | `5` | consecutive; then `crashed`, waiting for a human. |
| `autostart` | `true` | `false` = declared and listed, started on click or by a dependent. |
| `runtime` | — | `"in-process"` mounts the project's `src/` into this process instead of spawning anything — see below. |

Unknown keys are **provider input**, handed to the hook untouched — that is how
`"aidbox": { "license": "…" }` works.

`resolve.ts` is the only place defaults live, and the only place a manifest
fails: a `needs` cycle, a `needs` on something undeclared, two probes on one
service, `ready.http` without a port, two services publishing the same key.

## An app can run inside the workspace

A service declared `runtime: "in-process"` is not spawned at all: its `src/`
joins the scan roots under its own namespace and `loadFns` brings it into
`ctx.fns`. It is a plugin in everything but where it lives.

```jsonc
{ "services": { "aidbox": {}, "app": { "runtime": "in-process", "needs": ["aidbox"] } } }
```

`src/patients/search.ts` becomes `ctx.fns.app.patients.search`,
`src/patients/$route__GET.ts` becomes `GET /app/patients`. There is no port, no
readiness probe and no process to supervise; an edit is live after `dev.sync`,
and a file that does not compile fails the mount rather than a request — the
card goes `crashed` with the error on it.

The one thing the workspace has to do differently: a spawned child is handed the
shared environment, and an in-process app has no child to hand it to, so the
workspace adopts it into its own `process.env`. That is what lets the app read
`AIDBOX_BASE_URL` from `ctx.env` like any other service.

What it buys: one process, instant reload, and the agent can call the app's
functions directly instead of over HTTP. What it costs: no isolation — a
crash in app code is a crash of the workspace — one shared dependency tree, and
it only works for a procs project. Anything else still spawns.

## The environment

`services.env` computes one environment for the whole run: a free port
(`Bun.serve({port:0})`) per `portEnv` name, the resulting address in `urlEnv`,
everything anyone `publish`es, and `${NAME}` references resolved. Every child is
spawned with it. That is why the app finds Aidbox with no glue — both were
started knowing the same `AIDBOX_BASE_URL`.

`env` on a declaration is the exception: it belongs to that one child, so a
license or a password never leaks into the others. The computed environment only
ever *fills in* what is missing, so a restart keeps its port and a service added
to the manifest later gets one without moving anybody else's.

## Readiness is a start gate, not a monitor

`needs` waits for **ready**, not merely started, so nothing needs a sort
function: `start` awaits what it needs (starting an idle dependency itself),
independent services still come up in parallel, and the cycle check makes the
recursion finite. A dependency that misses its `ready.timeout` does not block the
dependent — it starts anyway and the card says so.

Nothing probes a service after it is up. A process that is alive but sick is
something you read the logs of; killing it would delete the evidence.

## A crash is an exit the supervisor did not ask for

`stop` (and therefore `restart`) sets `wanted = "down"` before it signals, so an
intended exit costs nothing. A real crash retries with a delay doubling from
`backoff` to 30 s, and gives up after `maxRestarts` consecutive attempts. The
counter resets after ten seconds of healthy uptime, so a service that dies once
an hour restarts forever while one that dies in 200 ms lands in `crashed` — with
its exit code and its logs still on screen.

A clean exit is not a failure: `restart: "on-failure"` is the default, so a
process that finishes with code 0 stays idle.

Children are spawned detached, so `stop` signals the whole process group —
SIGTERM, five seconds, SIGKILL. That is what takes `sh -lc "…"` down together
with the bun or docker beneath it, leaving nothing holding a port.

## State and logs

One record per **declared** service lives on `ctx.state.services` and is never
deleted while the workspace runs: a stopped service keeps its card, its logs and
its port. Logs are an in-memory ring (2000 lines, ANSI stripped) with one
monotonic `seq` per line — the SSE cursor for the live log pane. There are no
log files; the REPL is the grep.

## The functions

| | |
|---|---|
| manifest | `manifest` (read + normalise) · `resolve` (providers, defaults, validation) · `env` |
| lifecycle | `start` · `startAll` · `stop` · `restart` · `$start` · `$stop` |
| mechanics | `spawn` · `captureLogs` · `track` · `waitReady` · `probeReady` · `superviseExit` · `freePort` |
| reading | `status` · `logs` |

## The panel

`plugins/services` renders the `processes` tab: a row per service with a state
dot and chip, uptime, the port as a link, the restart count, the command, and
the last log lines; selecting one opens a live log pane fed by SSE. Start, stop
and restart are `POST /processes/:name/{start,stop,restart}` returning 204 — the
panel repaints from the `{type:"service"}` event, so an action taken from a
terminal shows up in the browser too.

## Using it from the REPL

```sh
.workspace/repl 'ctx.fns.services.status({})'
.workspace/repl 'ctx.fns.services.logs({ name: "app", lines: 80 })'
.workspace/repl 'await ctx.fns.services.restart({ name: "app" })'
.workspace/repl 'await ctx.fns.services.waitReady({ name: "app" })'
.workspace/repl 'await ctx.fns.services.env({})'      // the ports and addresses of this run
```

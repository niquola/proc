# The agent

The workspace hosts one coding agent and shows it as the chat in the left
column. It is an **ACP client**: the agent itself is a separate process
(`claude-agent-acp` or `codex-acp`) speaking the Agent Client Protocol over
stdio, so the reasoning loop, the tools and the system prompt are not ours. Ours
is everything around it — bringing the process up, owning the session, turning
its updates into a transcript, and staying alive when it does not.

Ported from `wmlet/src/topics.ts`, which does the same job for many topics at
once. The behaviours are kept; the multi-topic machinery is not.

## The shape

```
 browser ──POST /agent/prompt──►  prompt ──► sendPrompt ──► runPrompt ──► finishPrompt
    ▲                               │            │             │              │
    │ SSE {type:"agent"}            │ start      │ publish     │ callAcp      │ drains queue
    │                               ▼            ▼             ▼              ▼
 chat ◄── messages ◄── sqlite ◄── publish ◄── receive ◄── ClientSideConnection ◄── acp process
```

Two rules explain most of the design.

**Everything enters the transcript through `publish`.** An ACP update, the
user's own prompt, a synthetic "this tool was interrupted" — all of it folds
into a message row, is written, and rings the SSE bell. Persistence and the fold
rules exist in exactly one place.

**The database is the transcript.** There is no in-memory copy: `chat` renders
what `messages` reads from sqlite. Nothing to keep in sync, nothing to hydrate
at boot, and a restart loses nothing.

## Storage

One table, and the message travels as JSON:

```sql
CREATE TABLE agent_messages (
  id         TEXT PRIMARY KEY,   -- toolCallId for tools, random otherwise
  seq        INTEGER NOT NULL,   -- order
  message    TEXT NOT NULL,      -- the whole types.agent.Message
  updated_at TEXT NOT NULL
);
CREATE VIRTUAL TABLE agent_messages_fts USING fts5(id UNINDEXED, text);
```

Only what identifies and orders a row is a column, so a message growing a field
never needs a migration; triggers mirror `json_extract(message,'$.text')` into
FTS5, which is the whole of `search.ts`. `agent_session` holds the one row that
must survive a restart: the ACP session id, the agent id, the title, accumulated
agent time.

The fold in `publish`: text and thinking chunks append to the previous row when
`role`, `kind` and `messageId` all match, so a new `messageId` always starts a
new bubble; a tool call is one row keyed by `toolCallId`, updated in place from
first sighting to completion wherever it sits; a plan replaces the last row when
that row is a plan, because every plan update is the whole plan again.

## Bringing it up — `start`

A guard ladder in front, because the failure mode is two processes: a live
connection short-circuits; a connection whose signal aborted is a corpse, so the
child is killed and forgotten rather than reused; a start already in flight is
awaited instead of racing a second spawn.

Then: prepare the workdir (`writeHelpers`, `injectContext`) → spawn in `WORKDIR`
with three pipes → wire `handleExit` and `readStderr` **before** the connection,
so a process that dies during startup is still observed → build the
`ClientSideConnection`, delegating `sessionUpdate` to `receive` and
`requestPermission` to `decidePermission` → `initialize` under a timeout →
check credentials → restore the previous session or open a fresh one → only then
commit `acp`/`process`/`capabilities` to state.

Failure rethrows. The caller has to tell "log in" from "broken", and the auth
flag rides on the error.

`$start.ts` does **not** spawn: the chat shows history immediately after a
restart, and the agent comes up on the first prompt.

## Sessions survive disconnects

`clearConnection` drops the process, the connection and the capabilities — and
deliberately keeps `session`. So `handleExit` (the child died) and `handleClose`
(the transport died, the child may not have) both leave a session id behind, and
the next `start` calls `restoreSession`: `loadSession` with `agent.loading` set,
which suppresses the replayed updates that would otherwise duplicate the whole
transcript, then `settleTools` marks tool calls the restart orphaned as
interrupted. If the restore fails, the session is cleared and a fresh one is
opened — unless it failed on authentication, which is rethrown.

Both handlers guard on identity (`ctx.state.agent.process !== opts.proc → return`)
so a stale exit cannot clobber a newer agent.

## A turn

`prompt` is the only public entry. While the agent is starting, or while a turn
is running, the text is queued; otherwise `sendPrompt` clears the three flags,
publishes the user message and kicks off `runPrompt` un-awaited — the answer
arrives as session updates, not as a return value.

`runPrompt` holds the error policy, and its branching is the policy rather than
a shape to generalise:

| condition | what happens |
|---|---|
| `hit your (usage )?limit` | `usageLimit = true`, nothing else |
| `Authentication required` | `authRequired = true`, nothing else |
| `API Error: 400`, `could not process image`, … | `resetSession` then **exactly one** retry with the same text |
| retry failed, or anything else | `promptFailed = true` |

`finishPrompt` runs in `finally`, so after success, failure, retry and cancel
alike the queue drains and the status leaves `running`. Cancel does not clear
the queue: the next item starts immediately, which is what wmlet does and what
users expect from "stop this one".

## Status and flags

`status` is `offline | starting | idle | running`. The three flags —
`authRequired`, `usageLimit`, `promptFailed` — are orthogonal facts, all three
can be true, and the UI shows exactly one banner in that priority. The raw error
never reaches the chat; it is a stack trace, not a message.

## Timing

`trackTiming` accumulates only the spans the agent was actually working:
thinking (from the first thought chunk to the next non-thought update) and each
tool call (from `tool_call` to a terminal status). `finishPrompt`, `cancel` and
`handleExit` close a dangling think span, so a turn that ends on a thought does
not bill the idle gap after it.

## Files

| | |
|---|---|
| lifecycle | `start` `stop` `$start` `$stop` `clearConnection` `handleExit` `handleClose` `readStderr` |
| session | `openSession` `closeSession` `restoreSession` `resetSession` `settleTools` `setConfig` `models` |
| turn | `prompt` `sendPrompt` `runPrompt` `finishPrompt` `cancel` |
| ingress | `receive` `publish` `decidePermission` `trackTiming` |
| storage | `saveMessage` `saveState` `messages` `search` `$migration_001_agent` |
| plumbing | `callAcp` `classifyError` `resolveCommand` `checkCredentials` |
| workdir | `writeHelpers` `injectContext` |
| UI | `chat` `$route_chat_GET` `$route_prompt_POST` `$route_cancel_POST` `$route_config_POST` |

## Decisions

**One agent, one session, no topics.** wmlet runs many topics per workspace
because a workspace is a product surface there. Here the workspace *is* the
session; `ctx.state.agent` replaces the topic map and the reentrancy WeakMap
becomes one `starting` promise. Multiple conversations, if ever wanted, come
back as rows in `agent_session`, not as a second architecture.

**The db is the only transcript.** The plan originally had three copies — a raw
`agent_updates` protocol log, a derived `agent_messages` projection and an
in-memory mirror on `ctx.state`. Two of them were views of one thing. A raw
protocol log is an audit feature nobody asked for; it can come back the day
debugging needs it, without changing anything else.

**The message is JSON in one column** (taken from `~/hyper-code/chat/db.ts`).
Splitting a message across `title/status/data/message_id` columns buys nothing
we query on, and costs a migration every time the shape grows.

**One event, no payload.** `events.emit({type:"agent"})` says "something
changed"; the client refetches the fragment. Pushing deltas would mean the
browser holds state that can disagree with the database.

**No cost accounting.** wmlet's `totals.cost` / `lastCostSeen` delta logic is a
billing readout for a hosted product. We keep `usage` (how much context is
gone), which is the part a developer acts on.

**No `fs` capability.** wmlet advertises `fs` and `terminal` at `initialize`;
the agent already reads and writes files with its own tools, so advertising a
capability we would have to sandbox ourselves buys nothing.

**Only the model picker.** Session config options are stored, but only
`setConfig` has a route. Modes and slash commands are kept on state for the day
the UI wants them.

**No queue reordering.** Enqueue and cancel are the operations that came up;
drag-to-reorder was two files and a protocol nobody had asked for.

Four bugs in the source are deliberately not reproduced: the per-call timeout
timer that was never cleared, the `acp.closed` grace-kill that could never fire
because ownership was read after the state had been cleared, `+=` on token
counters that ACP documents as cumulative, and the loss of the session id when
the child exits.

You are reviewing 'proc' — a file-based, REPL-driven web framework on Bun in src/. Read CLAUDE.md first for the design, then review the whole src/ tree. Give a focused, senior-level review on exactly three axes, with concrete file:line findings and a fix for each:

1) SIMPLICITY — unnecessary complexity, duplication, indirection, or code that could be meaningfully simpler/smaller. Flag over-engineering.
2) LOGICAL ERRORS — real bugs, wrong edge-case handling, race conditions, footguns. Especially: the injecting Proxy in $main.ts (makeCtx/wrapFns, this.state.registry), loadFns, project/scan.ts+classify.ts, genTypes.ts (nested namespaces), http/ (match, dispatch, toResponse, $start, loadRoutes), repl/ (eval last-expression, load), dev/ (def rollback, sync, lint collisions, build/manifest static imports, watch), env/ (mode/pick/fork coexistence), events/, db/ (ctx-scoped connection).
3) CLEAN ARCHITECTURE — coupling, cohesion, consistency of the (ctx,session,opts) convention, abstraction leaks, naming, where boundaries are wrong.

Prioritize by severity. Be specific and concrete; no generic advice. If something is genuinely good/clean, say so briefly. End with the top 5 things you'd change.

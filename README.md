# procs

File-based FP framework on Bun: functions on disk → `ctx.fns` registry at runtime, web routes from file names, live REPL with hot-reload. See [CLAUDE.md](CLAUDE.md) for the full framework guide.

```sh
bun install
bun src/$main.ts                        # start server (PORT env, default 3000)
bun script/repl.ts 'Object.keys(ctx.fns)'  # eval inside the live server
```

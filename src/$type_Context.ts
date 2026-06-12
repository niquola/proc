// Per-ctx state. Framework-owned keys are typed here; app/plugin state uses the
// index signature, OR a typed slot declared via a `$state_<key>.ts` file (which
// genTypes merges into this global interface). The registry is here (the ctx.fns
// Proxy reads it), so a derived ctx (request / env.fork) carrying its own state
// stays self-consistent.
declare global {
    interface CtxState {
        registry: Record<string, any>;
        serverStart?: number;
        server?: { server: any; port: number };
        http?: { logFile: any };
        events?: { subs: Set<(e: any) => void> };
        middleware?: Array<{ prefix: string; segs: string[]; handler: Function }>;
        lifecycle?: { started: string[] };
        dev?: { errors: Map<string, string> };
        watcher?: any;
        db?: import("bun:sqlite").Database;
        [key: string]: any;
    }
}

// Every function in the project has the signature:
//     export default async function (ctx: Context, session: Session, opts: {...}) {...}
// When called through ctx.fns.* / ctx.<rootFn>, `ctx` and `session` are
// injected implicitly — callers pass only opts:
//     ctx.fns.notes.add({ text: "hi" })
// Raw functions live in ctx.state.registry; ctx.fns is an injecting Proxy
// (see $main.ts makeCtx). Per-request ctx = makeRequestCtx(rootCtx, session),
// so the session flows through the whole call chain automatically.
export type Context = RootFns & {
    env: Record<string, string | undefined>;
    state: CtxState;
    routes: Record<string, Record<string, Function>>;
    session: Session | null;
    fns: FnsRegistry;
};

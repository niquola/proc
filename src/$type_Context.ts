// Every function in the project has the signature:
//     export default async function (ctx: Context, session: Session, opts: {...}) {...}
// When called through ctx.fns.* / ctx.<rootFn>, `ctx` and `session` are
// injected implicitly — callers pass only opts:
//     ctx.fns.notes.add({ text: "hi" })
// Raw functions live in ctx.state.registry; ctx.fns is an injecting Proxy
// (see $main.ts makeCtx). Per-request ctx = Object.create(rootCtx) + session,
// so the session flows through the whole call chain automatically.
export type Context = RootFns & {
    env: Record<string, string | undefined>;
    state: Record<string, any>;
    routes: Record<string, Record<string, Function>>;
    session: Session | null;
    fns: FnsRegistry;
};

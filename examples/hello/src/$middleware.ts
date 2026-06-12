// $middleware.ts runs before every handler under /hello/* (the plugin's
// namespace prefix). It writes into the session (request-scoped) and the typed
// ctx.state.hello slot (process-global). Return a Response to short-circuit.
export default function (ctx: Context, session: Session, _opts: { req: Request; params: Record<string, string> }) {
    ctx.state.hello = { requests: (ctx.state.hello?.requests ?? 0) + 1 }; // typed via $state_hello.ts
    session.via = "hello-middleware";                                      // extends the session
}

// A plugin route — mounts at GET /hello/ping. Reads what the $middleware put on
// the session, and the typed ctx.state.hello slot.
export default function (ctx: Context, session: Session, _opts: { req: Request }) {
    return { ...ctx.fns.hello.world({ name: "ping" }), via: session.via, requests: ctx.state.hello?.requests };
}

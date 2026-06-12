// A plugin route — mounts at GET /hello/ping (namespace-prefixed).
export default function (ctx: Context, _session: Session, _opts: { req: Request }) {
    return ctx.fns.hello.world({ name: "ping" });
}

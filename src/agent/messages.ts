// The transcript, as plain data.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    return ctx.state.agent?.messages ?? [];
}

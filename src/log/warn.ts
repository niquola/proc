export default function (ctx: Context, session: Session | null, opts: { event: string; msg?: string; [key: string]: any }) {
    const { event, msg, ...attrs } = opts;
    return ctx.fns.log.emit({ severity: "warn", event, msg, attrs });
}

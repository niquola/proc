// Core log emitter — level gate + pretty/json formatting.
// All level functions (info/warn/error/debug) delegate here.
const OTEL_SEV: Record<string, number> = { debug: 5, info: 9, warn: 13, error: 17 };
const LEVEL_NUM: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS: Record<string, string> = { debug: "\x1b[36m", info: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" };
const RESET = "\x1b[0m";

export default function (ctx: Context, _session: Session | null, opts: {
    severity: string;
    event: string;
    msg?: string;
    attrs?: Record<string, any>;
}) {
    const st = ctx.state.log;
    if (!st) return;

    const num = LEVEL_NUM[opts.severity];
    if (num === undefined || num > st.level) return;

    const ts = new Date().toISOString();
    const body = opts.msg ?? opts.event;

    if (st.format === "json") {
        const attrs: Record<string, any> = { event: opts.event, ...(opts.attrs ?? {}) };
        if (ctx.session?.req) {
            attrs["http.method"] = ctx.session.req.method;
            attrs["http.url"] = ctx.session.url?.pathname;
        }
        const record: types.log.LogRecord = {
            Timestamp: ts,
            SeverityNumber: OTEL_SEV[opts.severity]!,
            SeverityText: opts.severity.toUpperCase(),
            Body: body,
            Attributes: attrs,
            Resource: { "service.name": st.service },
        };
        process.stdout.write(JSON.stringify(record) + "\n");
    } else {
        const color = COLORS[opts.severity] ?? "";
        const a = opts.attrs;
        const kvs = a ? Object.entries(a).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(" ") : "";
        console.log(`${color}[${opts.event}]${RESET} ${body}${kvs ? "  " + kvs : ""}`);
    }
}

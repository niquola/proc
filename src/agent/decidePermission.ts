// Answer an ACP session/request_permission without asking a human: this is a
// local dev agent and the loop must not stall. The ladder prefers the broadest
// grant first and only ever falls back to a reject option when the agent
// offered nothing else — never picking a reject while an allow is on the table.
//
// The return type is spelled out because it is an ACP RequestPermissionResponse:
// the outcome strings are literals there, so widening them to `string` would make
// start.ts hand the connection a value the SDK rejects.
type Decision = { outcome: { outcome: "cancelled" } | { outcome: "selected"; optionId: string } };

export default function (ctx: Context, _session: Session | null, opts: { options?: any[]; toolCall?: any }): Decision {
    try {
        const options = Array.isArray(opts.options) ? opts.options : [];
        const tool = opts.toolCall?.title ?? opts.toolCall?.kind ?? "unknown";
        const selected =
            options.find((o: any) => o.kind === "allow_always") ??
            options.find((o: any) => o.kind === "allow_once") ??
            options.find((o: any) => !String(o.kind ?? "").startsWith("reject")) ??
            options[0];

        if (!selected) {
            ctx.fns.log.info({ event: "agent.permission", msg: "no options, cancelling", tool });
            return { outcome: { outcome: "cancelled" } };
        }

        ctx.fns.log.info({ event: "agent.permission", msg: "selecting", tool, optionId: selected.optionId, kind: selected.kind });
        return { outcome: { outcome: "selected", optionId: selected.optionId } };
    } catch (error: any) {
        ctx.fns.log.error({ event: "agent.permission.failed", msg: String(error?.message ?? error) });
        return { outcome: { outcome: "cancelled" } };
    }
}

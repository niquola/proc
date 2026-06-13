// Introspect: { hookName: [registered ids] }.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    const h = ctx.state.hooks ?? {};
    return Object.fromEntries(Object.entries(h).map(([name, m]) => [name, [...m.keys()]]));
}

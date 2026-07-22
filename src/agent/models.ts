// The model options the agent advertises, and which one is current.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    const option = (ctx.state.agent?.config ?? []).find((o: any) => o.id === "model");
    return {
        current: option?.currentValue,
        options: (option?.options ?? []).map((o: any) => ({ value: o.value, name: o.name })),
    };
}

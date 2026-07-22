// Tail a service's captured output.
export default function (ctx: Context, _session: Session | null, opts: { name?: string; lines?: number }) {
    const service = (ctx.state.services ?? {})[opts.name ?? "app"];
    if (!service) return [];
    return service.logs.slice(-(opts.lines ?? 100));
}

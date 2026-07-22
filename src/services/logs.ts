// Read the log ring: the last N lines of one service, everything it produced
// after a cursor (`from`), or — with no name — every service interleaved, each
// line tagged with the service it came from. The ring is the transcript; the
// SSE stream is only a cursor over it, which is why `from` lives here and not
// in a replay buffer. Sync on purpose: it is a plain read of ctx.state.
const TAIL = 100;

export default function (ctx: Context, _session: Session | null, opts: { name?: string; lines?: number; from?: number }) {
    const services: Record<string, types.services.Service> = ctx.state.services ?? {};

    if (opts.name) {
        const lines: types.services.Line[] = services[opts.name]?.lines ?? [];
        if (opts.from !== undefined) return lines.filter((l) => l.seq > opts.from!);
        return lines.slice(-(opts.lines ?? TAIL));
    }

    const all = Object.values(services).flatMap((s) => (s.lines ?? []).map((l) => ({ ...l, name: s.name })));
    all.sort((a, b) => a.seq - b.seq);
    if (opts.from !== undefined) return all.filter((l) => l.seq > opts.from!);
    return all.slice(-(opts.lines ?? TAIL));
}

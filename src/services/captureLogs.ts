// Both pipes of one process into the service's ring, tagged with the stream they
// came from and numbered with a per-service counter that never resets. The ring
// is the transcript — `logs` slices it and the SSE route walks it by `seq` — so
// there is no second buffer anywhere and a reconnecting browser needs no replay.
//
// Chunks do not respect line boundaries, so a partial tail is carried to the
// next chunk and whatever is left when the pipe closes is flushed as its own
// line (a service that dies mid-`printf` still shows what it printed).
//
// Colour escapes are dropped on the way in: a pipe is not a terminal, nothing
// downstream renders them, and left in they show up as `[2m` litter in the pane,
// in the card's peek and in what the agent reads from `logs`.
const RING = 2000;
const ANSI = new RegExp("\\u001b\\[[0-9;?]*[ -/]*[@-~]", "g");

export default async function (ctx: Context, _session: Session | null, opts: { name: string; proc: any }): Promise<void> {
    const service = ctx.state.services?.[opts.name];
    if (!service) return;
    await Promise.all([
        pump(service, opts.proc.stdout, "out"),
        pump(service, opts.proc.stderr, "err"),
    ]);
}

async function pump(service: types.services.Service, stream: ReadableStream | null, kind: "out" | "err"): Promise<void> {
    if (!stream) return;
    const decoder = new TextDecoder();
    let rest = "";
    try {
        for await (const chunk of stream as any) {
            const parts = (rest + decoder.decode(chunk, { stream: true })).split("\n");
            rest = parts.pop() ?? "";
            for (const text of parts) push(service, kind, text);
        }
    } catch { /* the pipe went away with the process */ }
    if (rest) push(service, kind, rest);
}

function push(service: types.services.Service, stream: "out" | "err", text: string): void {
    service.lines.push({ seq: ++service.seq, stream, text: text.replace(ANSI, "") });
    if (service.lines.length > RING) service.lines.splice(0, service.lines.length - RING);
}

// GET /processes/:name/logs/stream — one service's output, live.
//
// The ring is the transcript and this is only a cursor over it: the client hands
// back the seq of the last line it already has (`?from=`, or `Last-Event-ID` when
// the browser reconnects by itself), and the route walks forward from there. So
// there is no replay buffer, a reconnect misses nothing and repeats nothing, and
// a chatty service cannot flood the shared `/events` stream or the other tabs.
//
// It never ends on its own — a stopped service simply stops producing lines,
// which is quieter than closing and letting EventSource reconnect in a loop.
const PERIOD_MS = 200;
const KEEPALIVE_MS = 25_000;

export default function (ctx: Context, _session: Session, opts: { req: Request; params: { name: string } }) {
    const name = opts.params.name;
    if (!ctx.state.services?.[name]) return new Response("no such service", { status: 404 });

    const resume = opts.req.headers.get("last-event-id") ?? new URL(opts.req.url).searchParams.get("from");
    let cursor = Number(resume) || 0;

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            let closed = false;
            const write = (text: string) => {
                if (closed) return;
                try { controller.enqueue(encoder.encode(text)); } catch { stop(); }
            };
            const flush = () => {
                for (const line of ctx.fns.services.logs({ name, from: cursor })) {
                    cursor = line.seq;
                    write(`id: ${line.seq}\ndata: ${JSON.stringify(line)}\n\n`);
                }
            };
            const poll = setInterval(flush, PERIOD_MS);
            const keepalive = setInterval(() => write(`: ping\n\n`), KEEPALIVE_MS);
            const stop = () => {
                if (closed) return;
                closed = true;
                clearInterval(poll);
                clearInterval(keepalive);
                try { controller.close(); } catch { /* already closed */ }
            };
            opts.req.signal.addEventListener("abort", stop);
            flush();
        },
    });

    return new Response(stream, {
        headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            "connection": "keep-alive",
        },
    });
}

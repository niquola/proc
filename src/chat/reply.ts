// The chat column as one response. Every route that changes the conversation —
// prompt, cancel, config, mode, dequeue — and the plain GET all answer with the
// same thing: `#chat` swapped whole, with the composer islands riding along out
// of band. Six copies of this drifted apart within a day of being written.
export default function (ctx: Context, _session: Session | null, _opts?: {}): Response {
    const html = [
        ctx.fns.chat.transcript({}),
        ctx.fns.chat.queue({ oob: true }),
        ctx.fns.chat.controls({ oob: true }),
        ctx.fns.chat.send({ oob: true }),
    ].join("\n");
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

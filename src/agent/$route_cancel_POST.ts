// POST /agent/cancel — stop the turn in flight, answer with the transcript and
// the composer's out-of-band islands (the send button flips back to "send").
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    try {
        await ctx.fns.agent.cancel({});
    } catch (error: any) {
        return new Response(String(error?.message ?? error), { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    return ctx.fns.chat.reply({});
}

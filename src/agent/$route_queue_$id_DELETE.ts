// DELETE /agent/queue/:id — drop one queued message, answer with the transcript
// and the composer's out-of-band islands, the same shape prompt and cancel
// answer with, so one swap refreshes the whole column.
export default async function (ctx: Context, _session: Session, opts: { params: { id: string } }) {
    ctx.fns.agent.dequeue({ id: opts.params.id });
    return ctx.fns.chat.reply({});
}

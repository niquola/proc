// Broadcast a reload event — every connected browser tab does location.reload().
export default function (ctx: Context): void {
    ctx.fns.events.emit(ctx, { event: { type: 'reload' } });
}

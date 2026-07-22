// Restart one service: stop it, then start it again.
//
// It is exactly stop-then-start and nothing else, because that is what makes a
// restart different from a crash. stop sets `wanted = "down"` before it
// signals, so handleExit sees an intended exit and does not count it against
// maxRestarts or arm a backoff timer; start then sets `wanted = "up"` and resets
// `restarts` to 0, which is why clicking restart on a crashed service always
// buys a fresh set of attempts.
//
// The ports are kept: they live in ctx.state.serviceEnv, which env only fills in
// for entries it is missing, so the child comes back on the same address and
// whoever published it (or interpolated it into TEMPORAL_ADDRESS) stays right.
export default async function (ctx: Context, _session: Session | null, opts: { name: string }) {
    await ctx.fns.services.stop({ name: opts.name });
    return ctx.fns.services.start({ name: opts.name });
}

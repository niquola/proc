// Mint the run's REPL secret before anything can call the endpoint, so a client
// on this machine finds .runtime/repl-secret already there. Minting it lazily
// meant the first call raced the file into existence and failed.
export default async function (ctx: Context, _config?: unknown) {
    await ctx.fns.repl.secret({});
}

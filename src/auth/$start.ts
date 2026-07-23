// At boot, when the gate is on: make sure there is a key, mint a token for the
// person running this, and print the link. That is the whole local story — no
// password to configure, no user store, and the way in is in the log where
// whoever started the process can see it.
export default async function (ctx: Context, _config?: unknown) {
    if (ctx.fns.config.resolve({ module: "auth" }).mode !== "on") return;

    const config = ctx.fns.config.resolve({ module: "auth" });
    const name = config.user || ctx.env.USER || ctx.env.USERNAME || "you";
    const token = await ctx.fns.auth.sign({ sub: name, name });
    const port = ctx.fns.config.resolve({ module: "http" }).port;

    console.log(`[auth] the web UI is closed — open this to sign in as ${name}:`);
    console.log(`[auth] http://localhost:${port}/auth?token=${token}`);
}

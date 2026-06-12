// The database location, chosen by environment (config is just a function).
//   test → in-memory (isolated, fast)   dev → a local file   prod → $DATABASE_URL
export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    return ctx.fns.env.pick({
        test: ":memory:",
        dev: "data/dev.sqlite",
        prod: ctx.env.DATABASE_URL ?? "data/prod.sqlite",
    });
}

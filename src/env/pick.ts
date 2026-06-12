// Pick a value for the current environment. The idiomatic way to vary config
// (DB url, external endpoints, flags) by env — a config fn is just a function:
//   // src/db/url.ts
//   export default (ctx, s) => ctx.fns.env.pick({
//     test: ":memory:", dev: "data/dev.sqlite", prod: ctx.env.DATABASE_URL,
//   });
// Falls back test→dev→prod so you can omit envs you don't special-case.
export default function <T>(ctx: Context, _session: Session | null, opts: { prod?: T; dev?: T; test?: T }): T {
    const mode = ctx.fns.env.mode();
    const v = opts[mode];
    return (v !== undefined ? v : opts.dev !== undefined ? opts.dev : opts.prod) as T;
}

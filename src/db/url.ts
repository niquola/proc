// The database location — resolved through the config system (defaults <
// package.json proc.prod.db < env DATABASE_URL). No import: the schema flows
// through ctx.state (the `import(...)` below is type-only and erased at runtime).
export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    return (ctx.fns.config.resolve({ module: "db" }) as ConfigOf<typeof import("./$config").default>).url;
}

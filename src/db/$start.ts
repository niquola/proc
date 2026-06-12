// db module init — open the connection eagerly at boot (instead of lazily on
// first query). The handle lives in ctx.state.db (set by db.conn). Listed in
// package.json proc.start before "http" so the db is ready when traffic starts.
export default function (ctx: Context, _session: Session | null, _config?: any) {
    ctx.fns.db.conn();
}

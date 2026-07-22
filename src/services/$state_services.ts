// ctx.state.services — one record per *declared* service, created by track and
// never deleted while it is running: a stopped service keeps its card, its logs
// and its port. This is the single shape the supervisor writes and the UI
// renders; status only makes a serialisable copy of it for the wire.
// The shared environment lives next to it on ctx.state.serviceEnv, so restarts
// keep the ports the workspace assigned.
export type services = Record<string, types.services.Service>;

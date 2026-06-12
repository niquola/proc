// $state_<key>.ts declares the type of ctx.state.<key> — here ctx.state.hello.
// The file exports `type <key>`; genTypes merges it into the CtxState interface,
// so ctx.state.hello is typed everywhere (set at runtime by the middleware below).
export type hello = { requests: number };

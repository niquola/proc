// ctx.state.appRoots — namespace → directory for every service declared
// `runtime: "in-process"`. project/roots reads it, services/start and stop write
// it; nothing else knows the app is not a plugin.
export type appRoots = Record<string, string>;

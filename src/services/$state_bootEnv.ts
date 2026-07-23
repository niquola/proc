// The environment the workspace process started with — captured once, before the
// supervisor computes anything. It is what tells "somebody else already runs
// this service" apart from "we published this address ourselves": an in-process
// app is handed the computed environment on ctx.env, so after it starts the two
// are indistinguishable without this.
export type bootEnv = Record<string, string | undefined>;

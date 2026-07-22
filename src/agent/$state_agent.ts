// ctx.state.agent — the live ACP connection, its session and the transcript.
export type agent = {
    process?: any;
    acp?: any;
    session?: string;
    config?: any[];   // ACP session config options (model picker, modes)
    status: "offline" | "starting" | "idle" | "running";
    messages: types.agent.Message[];
    error?: string;
};

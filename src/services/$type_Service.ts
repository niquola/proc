// The runtime record of one declared service — the single shape the supervisor
// writes and the UI renders. It exists for a service that is not running, so a
// stopped service keeps its card, its logs and its port.
//
// `state` is where the process is, `ready` is whether its probe passed, and
// `wanted` is what the supervisor *intends*: an exit while `wanted === "up"` is
// exactly what makes a crash a crash.
export type Service = {
    name: string;
    spec: types.services.Spec;
    state: "idle" | "starting" | "running" | "restarting" | "crashed";
    wanted: "up" | "down";
    ready: boolean;
    // Bun.Subprocess while alive; also the identity guard that keeps a stale
    // exit from clobbering a newer process.
    proc?: any;
    pid?: number;
    port?: number;
    url?: string;
    startedAt?: number;
    exitCode?: number | null;
    // Consecutive; reset by ten seconds of healthy uptime, and by `start`.
    restarts: number;
    timer?: any;
    error?: string;
    lines: types.services.Line[];
    seq: number;
};

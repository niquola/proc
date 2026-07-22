// One line of a service's output. `seq` is per service and monotonic across
// restarts, which is what lets the log stream be a plain cursor over the ring
// instead of a replay buffer.
export type Line = { seq: number; stream: "out" | "err"; text: string };

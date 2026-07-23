// ctx.state.agent — the live ACP connection and its session. The transcript is
// not here: it lives in sqlite (agent_messages), which is the only copy.
// Everything the connection owns is cleared on disconnect; the session identity
// survives, so a restart restores instead of starting over.
export type agent = {
    // connection — all of it dropped by clearConnection
    id: "claude" | "codex";
    process?: any;                 // Bun Subprocess<"pipe","pipe","pipe">
    acp?: any;                     // ClientSideConnection
    capabilities?: any;            // initialize().agentCapabilities
    starting?: Promise<void>;      // in-flight start — dedupes concurrent callers
    exited?: boolean;              // proc.exited fired; read by handleClose
    loading?: boolean;             // suppress the update replay during loadSession
    stderr: string[];              // last N lines, ring-capped

    // durable session identity
    session?: string;              // ACP sessionId — survives disconnect, enables restore
    title?: string;                // session_info_update

    // status and the three orthogonal flags
    status: "offline" | "starting" | "idle" | "running";
    authRequired: boolean;
    usageLimit: boolean;
    promptFailed: boolean;
    error?: string;

    // session state pushed by the agent
    config?: any[];                // SessionConfigOption[] — the model picker
    modes?: any;                   // SessionModeState from newSession/loadSession
    currentModeId?: string;
    commands?: any[];              // available_commands_update
    usage?: { used?: number; size?: number };   // context window, from usage_update

    // prompting
    prompt?: Promise<void>;        // in-flight turn
    queue: { id: string; text: string; author?: { id: string; name: string } }[];

    // timing
    totals: { agentMs: number };
    thinkStartedAt?: number;
    toolStartedAt: Record<string, number>;   // toolCallId → ms; a plain object stays serialisable
};

// One entry in the chat transcript, and the only shape it ever has: an
// agent_messages row, what publish.ts folds an update into, and what chat.ts
// renders. `kind` mirrors the ACP session update it came from, so text,
// thinking, plans and tool calls all render through the same row.
export type Message = {
    id: string;          // toolCallId for tools, random otherwise
    seq: number;         // monotonic order
    role: "user" | "agent";
    kind: "text" | "thought" | "tool" | "plan";
    text: string;
    messageId?: string;  // ACP messageId — chunks merge only within the same one
    title?: string;
    status?: string;     // tool status; "failed" with data.incomplete when a restart orphaned it
    data?: any;          // plan entries · tool meta
    at: string;
    updatedAt: string;
};

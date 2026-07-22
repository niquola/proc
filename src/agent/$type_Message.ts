// One entry in the chat transcript. `kind` mirrors the ACP session update it
// came from, so the UI renders text, thinking and tool calls the same way.
export type Message = {
    id: string;
    role: "user" | "agent";
    kind: "text" | "thought" | "tool";
    text: string;
    title?: string;
    status?: string;
    at: string;
};

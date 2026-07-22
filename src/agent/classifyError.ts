// The one place an error becomes flags. Every branch that reacts to a failure —
// prompt, restore, stderr — asks here instead of matching its own regex, so the
// policy stays in one file. A string is a valid error: stderr lines come in as-is.
export default function (ctx: Context, _session: Session | null, opts: { error: unknown }) {
    const message = describe(opts.error);
    const thrown = opts.error as { authRequired?: unknown } | null;
    return {
        message,
        // start.ts throws with the flag set, so auth survives without a regex round-trip
        authRequired: (thrown && typeof thrown === "object" && thrown.authRequired === true) || /Authentication required/i.test(message),
        usageLimit: /hit your (usage )?limit/i.test(message),
        // errors the agent cannot recover from inside the session — a fresh one may work
        resettable:
            /API Error:\s*400\b/i.test(message) ||
            /could not process image/i.test(message) ||
            /invalid image/i.test(message) ||
            /unsupported image/i.test(message) ||
            /invalid request/i.test(message) ||
            /content too large/i.test(message),
    };
}

function describe(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
        const value = error as Record<string, unknown>;
        const parts: string[] = [];
        if (typeof value.message === "string" && value.message) parts.push(value.message);
        if (typeof value.code === "string" || typeof value.code === "number") parts.push(`code=${String(value.code)}`);
        if (value.data !== undefined) parts.push(`data=${stringify(value.data)}`);
        if (parts.length > 0) return parts.join(" ");
        return stringify(value);
    }
    return String(error);
}

function stringify(value: unknown): string {
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return String(value);
    }
}

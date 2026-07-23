// The single way anything enters the transcript: fold one session update into a
// message row, save it, broadcast. Agent updates and locally generated ones
// (the user's own prompt, a synthetic config or tool_call_update) all go through
// here, so persistence and the fold rules exist in exactly one place.
//
// The fold reads the previous row from the db — sqlite is the only transcript,
// there is no in-memory mirror to keep in sync:
//   · text/thought chunks append to the last row when role, kind and messageId
//     all match — a new messageId therefore always starts a new bubble;
//   · a tool call is one row keyed by its toolCallId, updated in place from
//     first sighting to completed/failed wherever it sits in the transcript;
//   · a plan replaces the last row when that row is a plan, since every plan
//     update is the whole plan again.
// Returns the saved message, or null when the update carries nothing to show.

// Codex narrates its own transport recovery as agent text. It is noise about
// the connection, not about the work, so it never reaches the transcript.
const NOISE = /^(Falling back from WebSockets to HTTPS transport\.|stream disconnected before completion:)/i;

export default function (
    ctx: Context,
    _session: Session | null,
    // `source` is accepted so callers can stay explicit about who spoke; the
    // role itself comes from the update kind, which cannot disagree with itself.
    opts: { update: any; source?: "agent" | "user"; author?: { id: string; name: string } },
): types.agent.Message | null {
    const u = opts.update;
    const kind = u?.sessionUpdate;
    const text = readText(u);
    const now = new Date().toISOString();

    if (kind === "agent_message_chunk" && NOISE.test(text.trim())) {
        ctx.fns.log.debug({ event: "agent.diagnostic", msg: text.trim() });
        return null;
    }

    let message: types.agent.Message;

    if (kind === "tool_call" || kind === "tool_call_update") {
        const id = u.toolCallId ?? crypto.randomUUID();
        const row = readRow(ctx, "WHERE id = ?", [id]);
        message = {
            id,
            seq: row?.seq ?? nextSeq(ctx),
            role: "agent",
            kind: "tool",
            // An update with no content is a status change; it must not erase
            // the output the tool already produced.
            text: text || row?.text || "",
            title: u.title ?? row?.title ?? u.kind ?? "tool",
            status: u.status ?? row?.status ?? "pending",
            data: mergeToolData(row?.data, u),
            at: row?.at ?? now,
            updatedAt: now,
        };
    } else if (kind === "user_message_chunk" || kind === "agent_message_chunk" || kind === "agent_thought_chunk") {
        const role = kind === "user_message_chunk" ? "user" : "agent";
        const chunk = kind === "agent_thought_chunk" ? "thought" : "text";
        const last = readRow(ctx, "ORDER BY seq DESC LIMIT 1", []);
        const merge = last?.role === role && last.kind === chunk && last.messageId === (u.messageId ?? undefined);
        message = merge
            ? { ...last, text: last.text + text, updatedAt: now }
            : { id: crypto.randomUUID(), seq: (last?.seq ?? 0) + 1, role, kind: chunk, text, messageId: u.messageId ?? undefined, author: opts.author, at: now, updatedAt: now };
    } else if (kind === "plan") {
        const last = readRow(ctx, "ORDER BY seq DESC LIMIT 1", []);
        const plan = last?.kind === "plan" ? last : undefined;
        message = {
            id: plan?.id ?? crypto.randomUUID(),
            seq: plan?.seq ?? (last?.seq ?? 0) + 1,
            role: "agent",
            kind: "plan",
            text: "",
            data: { entries: Array.isArray(u.entries) ? u.entries : [] },
            at: plan?.at ?? now,
            updatedAt: now,
        };
    } else {
        return null;
    }

    ctx.fns.agent.saveMessage({ message });
    ctx.fns.events.emit({ event: { type: "agent" } });
    return message;
}

// Chunks carry one content block, tool calls an array of them; both reduce to
// the text a human reads.
function readText(u: any): string {
    const c = u?.content;
    if (!c) return "";
    if (Array.isArray(c)) return c.map((i: any) => i?.content?.text ?? i?.text ?? "").join("");
    return c.type === "text" ? c.text ?? "" : "";
}

// A later update only carries what changed, so a field it omits must keep the
// value the first update gave it — hence the undefined skip.
function mergeToolData(prev: any, u: any): any {
    const data = { ...prev };
    const next = { kind: u.kind, rawInput: u.rawInput, locations: u.locations, startedAt: u._startedAt, completedAt: u._completedAt, incomplete: u._meta?.incomplete };
    for (const [k, v] of Object.entries(next)) if (v !== undefined) data[k] = v;
    return data;
}

function readRow(ctx: Context, tail: string, params: any[]): types.agent.Message | undefined {
    const r = ctx.fns.db.query({ sql: `SELECT message FROM agent_messages ${tail}`, params })[0];
    return r ? JSON.parse(r.message) : undefined;
}

function nextSeq(ctx: Context): number {
    return (ctx.fns.db.query({ sql: `SELECT MAX(seq) AS seq FROM agent_messages` })[0]?.seq ?? 0) + 1;
}

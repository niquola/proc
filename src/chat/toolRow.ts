// One tool call as a `<details>` row: icon, verb-split title, state chip,
// duration, and the payload broken into labelled sections. Ported from wmlet's
// tools.tsx — same markup, same classes, same Phosphor icons.
//
// wmlet reads its sections off the live ACP ToolCall (content blocks, rawOutput,
// `_meta.claudeCode`). procs keeps one row per tool in sqlite, so the same
// information arrives folded: `text` is the tool's output, `data` carries
// `{ kind, rawInput, locations, startedAt, completedAt, incomplete }`. The
// section builders below read those instead; the diff is rebuilt from the edit's
// own old/new strings, which is the fallback wmlet already had.
//
// `name` makes the rows an exclusive accordion (the pill panel passes its own id
// so only one row in a group is open); `open` is for a group of exactly one.
export default function (
    ctx: Context,
    _session: Session | null,
    opts: { message: types.agent.Message; name?: string; open?: boolean },
): string {
    const message = opts.message;
    const { kind, ...meta } = ctx.fns.chat.toolMeta({ message });
    const sections = toolSections(message, kind);
    const state = toolState(message, sections);
    const running = state === "running";
    const title = toolTitle(message, kind, meta.label);
    const duration = toolDuration(message);

    const iconColor =
        state === "failed" ? "text-state-danger-fg"
            : state === "incomplete" ? "text-state-warning-fg"
                : running ? "text-text-primary"
                    : "text-text-muted";
    const stateColor =
        state === "failed" ? "text-state-danger-fg"
            : state === "incomplete" ? "text-state-warning-fg"
                : "text-text-tertiary";
    const stateLabel = state ? `${state[0]!.toUpperCase()}${state.slice(1)}` : "";

    const startsWithLabel = title.toLowerCase().startsWith(`${meta.label.toLowerCase()} `);
    const verb = startsWithLabel ? meta.label : null;
    const rest = startsWithLabel ? title.slice(meta.label.length + 1) : title;
    const restIsMono = startsWithLabel || kind === "execute";

    const esc = (text: unknown) => ctx.fns.chat.escape({ text });
    const details = sections.map(section => renderSection(esc, section)).join("");
    const empty = state === "incomplete"
        ? "No result was recorded before this action stopped."
        : "No structured payload was provided.";

    return `<details class="group tool-action-row" name="${esc(opts.name ?? "chat-tool")}"${opts.open ? " open" : ""} data-entity="tool" data-id="${esc(message.id)}">
  <summary class="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-bg-tertiary group-open:bg-bg-tertiary">
    <i class="ph text-[15px] shrink-0 ${meta.icon} ${iconColor}${running ? " animate-pulse" : ""}"${running ? ` data-running="true"` : ""} aria-hidden="true"></i>
    <span class="min-w-0 flex-1 truncate text-ui text-text-primary" title="${esc(title)}">${verb ? `${esc(verb)} ` : ""}<span${restIsMono ? ` class="font-mono text-[12px] text-text-muted"` : ""}>${esc(rest)}</span></span>
    <span class="flex shrink-0 items-center gap-1.5">
${stateLabel ? `      <span class="text-2xs font-medium ${stateColor}">${stateLabel}</span>\n` : ""}${duration ? `      <span class="text-2xs text-text-tertiary tabular-nums">${duration}</span>\n` : ""}      <i class="tool-action-chevron ph ph-caret-right text-text-placeholder transition-transform duration-150 group-open:rotate-90" aria-hidden="true"></i>
    </span>
  </summary>
  <div class="space-y-2 px-3 pb-3 pl-10 mt-2">${details || `<div class="text-2xs text-text-tertiary">${empty}</div>`}</div>
</details>`;
}

// ---------------------------------------------------------------- constants

const TOOL_DETAIL_LIMIT = 2400;
const DIFF_CONTEXT_LINES = 3;
const MAX_DIFF_DISTANCE = 200;
const ANSI_OSC_PATTERN = /\x1B\][^\x07]*(?:\x07|\x1B\\)/g;
const ANSI_CSI_PATTERN = /\x1B(?:\[[0-?]*[ -/]*[@-~]|[@-_])|\x9B[0-?]*[ -/]*[@-~]/g;
const TERMINAL_REDRAW_PATTERN = /[^\n]*(?:\r|\x1B\[[0-9;]*(?:D|G)\x1B\[[0-9;]*(?:J|K))/g;
const TOOL_INPUT_METADATA_KEYS = new Set([
    "call_id", "process_id", "turn_id", "started_at_ms", "workdir", "cwd", "yield_time_ms",
    "max_output_tokens", "sandbox_permissions", "justification", "prefix_rule", "login", "shell", "tty",
]);

type Section = { label: string; text: string; preview?: string };
type Diff = { path: string; oldText: string | null; newText: string | null };

// ---------------------------------------------------------------- markup

function renderSection(esc: (text: unknown) => string, section: Section): string {
    const truncated = section.preview !== undefined;
    const outputClass = "overflow-x-auto rounded border border-border-subtle bg-bg-tertiary px-2 py-1.5 font-mono text-2xs leading-4 text-text-muted";
    const label = `Copy ${truncated ? "full " : ""}${section.label}`;
    const body = truncated
        ? `<div class="flex flex-col">
        <details class="tool-output-full order-2 mt-1">
          <summary class="cursor-pointer text-2xs text-text-tertiary hover:text-text-primary">Show full ${esc(section.label)}</summary>
          <pre class="tool-output mt-1 ${outputClass}">${esc(section.text)}</pre>
        </details>
        <pre class="tool-output-preview order-1 ${outputClass}">${esc(section.preview ?? "")}</pre>
      </div>`
        : `<pre class="tool-output ${outputClass}">${esc(section.text)}</pre>`;
    // The button carries the text it copies — same string the <pre> shows, so
    // nothing has to be read back out of the DOM.
    const payload = esc(JSON.stringify({ text: section.text }));
    return `
    <div class="tool-text-block">
      <div class="mb-1 flex items-center justify-between gap-2">
        <div class="text-2xs font-medium text-text-tertiary">${esc(section.label)}</div>
        <button type="button"
          class="inline-flex size-6 items-center justify-center rounded text-text-tertiary hover:bg-bg-quaternary hover:text-text-primary"
          title="${esc(label)}" aria-label="${esc(label)}"
          data-action="copy" hx-on:click="window.chat.copy(this, ${payload})">
          <i class="ph ph-copy-simple text-3xs" aria-hidden="true"></i>
        </button>
      </div>
      ${body}
    </div>`;
}

// ---------------------------------------------------------------- identity

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizedKind(kind?: string | null): string | null {
    return kind?.trim().toLowerCase().replace(/[-\s]+/g, "_") || null;
}

function parsedCommands(value: unknown): Record<string, unknown>[] {
    const input = record(value);
    return Array.isArray(input?.parsed_cmd)
        ? input.parsed_cmd.map(record).filter((item): item is Record<string, unknown> => Boolean(item))
        : [];
}

function toolCommand(value: unknown): string {
    const input = record(value);
    if (typeof input?.cmd === "string") return input.cmd;
    if (typeof input?.command === "string") return input.command;
    if (Array.isArray(input?.command)) {
        const shell = input.command.length >= 3 && input.command[0] === "/bin/bash" && input.command[1] === "-lc"
            ? input.command[2]
            : undefined;
        return typeof shell === "string" ? shell : input.command.map((item: unknown) => String(item)).join(" ");
    }
    const command = parsedCommands(value).find(item => typeof item.cmd === "string")?.cmd;
    return typeof command === "string" ? command : "";
}

function toolTitle(message: types.agent.Message, kind: string, label: string): string {
    const title = message.title?.trim() || "";
    const input = record(message.data?.rawInput);
    const description = typeof input?.description === "string" ? input.description.trim() : "";
    if (description) return truncate(description);
    const command = toolCommand(message.data?.rawInput);
    const generic = title.toLowerCase().replace(/[-\s]+/g, "_");
    if (command && (kind === "execute" || generic === "exec_command")) return truncate(command);
    return title || label;
}

function truncate(text: string, limit = 96): string {
    return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function isRunning(status?: string | null): boolean {
    return status === "in_progress" || status === "running" || status === "pending";
}

// An interrupted call outranks a failed one: settleTools marks an orphaned row
// `failed` + `incomplete`, and the transcript should say it stopped, not that it
// broke.
function toolState(message: types.agent.Message, sections: Section[]): "failed" | "running" | "incomplete" | undefined {
    if (message.data?.incomplete === true) return "incomplete";
    if (message.status === "failed" || sections.some(section => section.label === "Error")) return "failed";
    if (!isRunning(message.status)) return undefined;
    return "running";
}

function toolDuration(message: types.agent.Message): string {
    const startedAt = message.data?.startedAt;
    const completedAt = message.data?.completedAt;
    if (typeof startedAt !== "number" || typeof completedAt !== "number") return "";
    const ms = completedAt - startedAt;
    return ms >= 0 ? formatDuration(ms) : "";
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds - minutes * 60);
    return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

// ---------------------------------------------------------------- text

function cleanText(text: string): string {
    return text
        .replace(/\r\n/g, "\n")
        .replace(TERMINAL_REDRAW_PATTERN, "")
        .replace(ANSI_OSC_PATTERN, "")
        .replace(ANSI_CSI_PATTERN, "")
        .replace(/<\/?(?:tool_use_error|system-reminder)>/g, "");
}

function indent(text: string): string {
    return text.split("\n").map(line => `  ${line}`).join("\n");
}

function formatValue(value: unknown, seen = new WeakSet<object>()): string {
    if (typeof value === "string") return cleanText(value);
    if (value === null) return "null";
    if (value === undefined) return "";
    if (typeof value !== "object") return String(value);
    if (seen.has(value)) return "[Circular]";
    seen.add(value);

    if (Array.isArray(value)) {
        return value.map(item => {
            const text = formatValue(item, seen);
            return text.includes("\n") ? `-\n${indent(text)}` : `- ${text}`;
        }).join("\n");
    }

    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    if (entries.every(([, item]) => record(item) && Object.keys(item as Record<string, unknown>).length === 0)) {
        return entries.map(([key]) => key).join("\n");
    }
    return entries.map(([key, item]) => {
        const text = formatValue(item, seen);
        return item && typeof item === "object" ? `${key}:\n${indent(text)}` : `${key}: ${text}`;
    }).join("\n");
}

function preview(text: string, limit = TOOL_DETAIL_LIMIT): string {
    if (text.length <= limit) return text;
    const marker = (omitted: number) => `\n… ${omitted} characters omitted …\n`;
    let edge = Math.floor((limit - marker(text.length - limit).length) / 2);
    let omitted = text.length - edge * 2;
    edge = Math.floor((limit - marker(omitted).length) / 2);
    omitted = text.length - edge * 2;
    return `${text.slice(0, edge)}${marker(omitted)}${text.slice(-edge)}`;
}

function section(label: string, value: unknown): Section | null {
    if (value === undefined || value === null) return null;
    if (Array.isArray(value) && value.length === 0) return null;
    const rec = record(value);
    if (rec && Object.keys(rec).length === 0) return null;
    const text = formatValue(value);
    const short = preview(text);
    return text.trim().length > 0 ? { label, text, ...(short === text ? {} : { preview: short }) } : null;
}

function keep(sections: Array<Section | null>): Section[] {
    return sections.filter((item): item is Section => Boolean(item));
}

// `<system-reminder>` blocks are the harness talking, not the file — wmlet lifts
// them into their own Notice section so the content stays readable.
function splitNotices(text: string): { content: string; notices: string[] } {
    const notices: string[] = [];
    const content = text.replace(/<system-reminder>([\s\S]*?)<\/system-reminder>/g, (_match, notice: string) => {
        notices.push(cleanText(notice).trim());
        return "";
    });
    return { content: cleanText(content).trim(), notices };
}

// What the tool produced, or the stand-in for "it finished with nothing".
function toolResult(message: types.agent.Message, empty: string): unknown {
    const text = cleanText(message.text ?? "").trimEnd();
    if (text.trim()) return text;
    if (message.data?.incomplete === true) return undefined;
    if (message.status === "failed") return "Tool failed";
    if (message.status === "completed") return empty;
    return undefined;
}

function toolPaths(message: types.agent.Message, ...fallbacks: unknown[]): string[] {
    const locations = Array.isArray(message.data?.locations) ? message.data.locations : [];
    return [...new Set([
        ...locations.map((location: any) => location?.path).filter((path: unknown): path is string => typeof path === "string"),
        ...fallbacks.filter((value): value is string => typeof value === "string" && value.length > 0),
    ])];
}

function rawInputWithoutMetadata(value: unknown): unknown {
    const input = record(value);
    if (!input) return value;
    const command = toolCommand(value);
    if (command) return command;
    const entries = Object.entries(input).filter(([key]) => !TOOL_INPUT_METADATA_KEYS.has(key));
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

// ---------------------------------------------------------------- diff

type LineChange = [" " | "-" | "+", string];

function backtrackChanges(oldLines: string[], newLines: string[], trace: Map<number, number>[]): LineChange[] {
    let oldIndex = oldLines.length;
    let newIndex = newLines.length;
    const changes: LineChange[] = [];
    for (let distance = trace.length - 1; distance >= 0; distance--) {
        const furthest = trace[distance]!;
        const diagonal = oldIndex - newIndex;
        const left = furthest.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY;
        const down = furthest.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY;
        const previousDiagonal = diagonal === -distance || (diagonal !== distance && left < down) ? diagonal + 1 : diagonal - 1;
        const previousOld = furthest.get(previousDiagonal) ?? 0;
        const previousNew = previousOld - previousDiagonal;

        while (oldIndex > previousOld && newIndex > previousNew) {
            changes.push([" ", oldLines[oldIndex - 1]!]);
            oldIndex--;
            newIndex--;
        }
        if (distance === 0) break;
        changes.push(oldIndex === previousOld ? ["+", newLines[previousNew]!] : ["-", oldLines[previousOld]!]);
        oldIndex = previousOld;
        newIndex = previousNew;
    }
    return changes.reverse();
}

function lineChanges(oldLines: string[], newLines: string[]): LineChange[] | null {
    const furthest = new Map<number, number>([[1, 0]]);
    const trace: Map<number, number>[] = [];
    const maxDistance = Math.min(oldLines.length + newLines.length, MAX_DIFF_DISTANCE);
    for (let distance = 0; distance <= maxDistance; distance++) {
        trace.push(new Map(furthest));
        for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
            const left = furthest.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY;
            const down = furthest.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY;
            let oldIndex = diagonal === -distance || (diagonal !== distance && left < down) ? down : left + 1;
            if (!Number.isFinite(oldIndex)) oldIndex = 0;
            let newIndex = oldIndex - diagonal;
            while (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
                oldIndex++;
                newIndex++;
            }
            furthest.set(diagonal, oldIndex);
            if (oldIndex >= oldLines.length && newIndex >= newLines.length) return backtrackChanges(oldLines, newLines, trace);
        }
    }
    return null;
}

// The rewrite was too large to diff line by line; show the one changed span with
// context instead of walking the whole file.
function formatChangedSpan(path: string, oldLines: string[], newLines: string[]): string {
    let prefix = 0;
    while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
    if (prefix === oldLines.length && prefix === newLines.length) return [`--- ${path}`, `+++ ${path}`].join("\n");

    let suffix = 0;
    while (
        suffix < oldLines.length - prefix &&
        suffix < newLines.length - prefix &&
        oldLines[oldLines.length - suffix - 1] === newLines[newLines.length - suffix - 1]
    ) suffix++;

    const contextStart = Math.max(0, prefix - DIFF_CONTEXT_LINES);
    const contextEnd = Math.min(suffix, DIFF_CONTEXT_LINES);
    const oldEnd = oldLines.length - suffix;
    const newEnd = newLines.length - suffix;
    const oldCount = prefix - contextStart + (oldEnd - prefix) + contextEnd;
    const newCount = prefix - contextStart + (newEnd - prefix) + contextEnd;
    return [
        `--- ${path}`,
        `+++ ${path}`,
        `@@ -${contextStart + 1},${oldCount} +${contextStart + 1},${newCount} @@`,
        oldLines.slice(contextStart, prefix).map(line => ` ${line}`).join("\n"),
        oldLines.slice(prefix, oldEnd).map(line => `-${line}`).join("\n"),
        newLines.slice(prefix, newEnd).map(line => `+${line}`).join("\n"),
        newLines.slice(newEnd, newEnd + contextEnd).map(line => ` ${line}`).join("\n"),
    ].filter(Boolean).join("\n");
}

function formatDiff(diff: Diff): string {
    const oldLines = diff.oldText ? diff.oldText.replace(/\r\n/g, "\n").split("\n") : [];
    const newLines = diff.newText ? diff.newText.replace(/\r\n/g, "\n").split("\n") : [];
    const changes = lineChanges(oldLines, newLines);
    if (!changes) return formatChangedSpan(diff.path, oldLines, newLines);

    const changed = changes.flatMap(([marker], index) => (marker === " " ? [] : [index]));
    const lines = [`--- ${diff.path}`, `+++ ${diff.path}`];
    if (changed.length === 0) return lines.join("\n");

    const hunks: Array<[number, number]> = [];
    for (const index of changed) {
        const start = Math.max(0, index - DIFF_CONTEXT_LINES);
        const end = Math.min(changes.length, index + DIFF_CONTEXT_LINES + 1);
        const last = hunks.at(-1);
        if (last && start <= last[1]) last[1] = Math.max(last[1], end);
        else hunks.push([start, end]);
    }

    let oldLine = 1;
    let newLine = 1;
    const positions = changes.map(([marker]) => {
        const position = [oldLine, newLine] as const;
        if (marker !== "+") oldLine++;
        if (marker !== "-") newLine++;
        return position;
    });
    for (const [start, end] of hunks) {
        const hunk = changes.slice(start, end);
        const oldCount = hunk.filter(([marker]) => marker !== "+").length;
        const newCount = hunk.filter(([marker]) => marker !== "-").length;
        const position = positions[start]!;
        lines.push(`@@ -${position[0]},${oldCount} +${position[1]},${newCount} @@`);
        for (const [marker, line] of hunk) lines.push(`${marker}${line}`);
    }
    return lines.join("\n");
}

function diffSection(diffs: Diff[]): Section | null {
    if (diffs.length === 0) return null;
    const text = diffs.map(formatDiff).join("\n");
    const short = preview(text);
    return { label: "Diff", text, ...(short === text ? {} : { preview: short }) };
}

// ---------------------------------------------------------------- errors

type ToolError = { message: string; stack?: string; output?: unknown; result?: unknown; details?: Record<string, unknown> };

// A tool that answers `{ success: false }` or `{ error: … }` reported failure in
// its payload rather than its status; the row should say so too.
function semanticError(value: unknown): ToolError | null {
    let rec = record(value);
    if (typeof value === "string") {
        try {
            rec = record(JSON.parse(cleanText(value).trim()));
        } catch {
            return null;
        }
    }
    if (!rec) return null;
    const status = typeof rec.status === "string" ? rec.status.toLowerCase() : "";
    const error = rec.error;
    const failed = rec.success === false || status === "error" || status === "failed" ||
        (error !== undefined && error !== null && error !== false && error !== "");
    if (!failed) return null;
    const message = error !== undefined && error !== null && error !== false && error !== ""
        ? formatValue(error)
        : typeof rec.message === "string" ? cleanText(rec.message) : "Tool failed";
    const details = Object.fromEntries(Object.entries(rec).filter(
        ([key]) => !["success", "status", "error", "message", "stack", "output", "result", "return"].includes(key),
    ));
    return {
        message,
        stack: typeof rec.stack === "string" && rec.stack.trim() ? cleanText(rec.stack) : undefined,
        output: rec.output,
        result: Object.hasOwn(rec, "return") ? rec.return : rec.result,
        details: Object.keys(details).length > 0 ? details : undefined,
    };
}

function errorSections(error: ToolError, output: unknown = error.output, result: unknown = error.result, resultLabel = "Result"): Section[] {
    return keep([
        section("Output", output),
        section(resultLabel, result),
        section("Error", error.message),
        section("Stack", error.stack),
        section("Details", error.details),
    ]);
}

function resultSections(label: string, value: unknown): Section[] {
    const error = semanticError(value);
    if (error) return errorSections(error);
    return keep([section(label, value)]);
}

// ---------------------------------------------------------------- repl output

type ParsedObject = { start: number; end: number; value: Record<string, unknown> };
type ReplResult = { output?: unknown; result?: unknown; resultLabel?: string; error?: ToolError };

function parseJsonObjects(text: string): ParsedObject[] {
    const trimmed = text.trim();
    if (/^"(?:success|output|result|return)"\s*:/.test(trimmed) && trimmed.endsWith("}")) {
        try {
            const value = record(JSON.parse(`{${trimmed}`));
            if (value) return [{ start: text.indexOf(trimmed), end: text.length, value }];
        } catch {
            // Fall through to the complete objects inside the fragment.
        }
    }
    const objects: ParsedObject[] = [];
    for (let start = 0; start < text.length; start++) {
        if (text[start] !== "{") continue;
        let depth = 0;
        let quoted = false;
        let escaped = false;
        for (let end = start; end < text.length; end++) {
            const character = text[end];
            if (quoted) {
                if (escaped) escaped = false;
                else if (character === "\\") escaped = true;
                else if (character === '"') quoted = false;
                continue;
            }
            if (character === '"') quoted = true;
            else if (character === "{") depth++;
            else if (character === "}" && --depth === 0) {
                try {
                    const value = record(JSON.parse(text.slice(start, end + 1)));
                    if (value) {
                        objects.push({ start, end: end + 1, value });
                        start = end;
                    }
                } catch {
                    // That brace belonged to ordinary command output.
                }
                break;
            }
        }
    }
    return objects;
}

// `bun script/repl.ts` answers with a { success, output, return } envelope; this
// is the workspace's most common command, so its two halves get their own
// sections instead of one wall of JSON.
function isReplCommand(command: string): boolean {
    return command.includes("script/repl.ts") || /\/repl(?:[/?'"\s]|$)/.test(command) || /\/tasks\/.*\.output\b/.test(command);
}

function formatReplValue(value: unknown): string {
    if (typeof value !== "string") return formatValue(value);
    const text = cleanText(value);
    try {
        const parsed = JSON.parse(text.trim());
        return parsed && typeof parsed === "object" ? formatValue(parsed) : text;
    } catch {
        return text;
    }
}

// A partial envelope — the fields streamed out without the wrapping braces.
function replFragment(text: string): { output: string[]; results: unknown[]; error?: ToolError } | null {
    if (!/^\s*"(?:success|output|result|return)"\s*:/m.test(text)) return null;
    const lines = text.split("\n");
    const output: string[] = [];
    const results: unknown[] = [];
    let resultLines: string[] | null = null;
    let resultDepth = 0;

    const depth = (value: string) => {
        let count = 0;
        let quoted = false;
        let escaped = false;
        for (const character of value) {
            if (quoted) {
                if (escaped) escaped = false;
                else if (character === "\\") escaped = true;
                else if (character === '"') quoted = false;
            } else if (character === '"') quoted = true;
            else if (character === "{" || character === "[") count++;
            else if (character === "}" || character === "]") count--;
        }
        return count;
    };
    const parse = (source: string): unknown => {
        const trimmed = source.trim().replace(/,$/, "");
        try {
            return JSON.parse(trimmed);
        } catch {
            return trimmed;
        }
    };
    const finish = () => {
        if (!resultLines) return;
        while (resultLines.at(-1)?.trim() === "}" && depth(resultLines.join("\n")) < 0) resultLines.pop();
        const result = parse(resultLines.join("\n"));
        if (result !== "") results.push(result);
        resultLines = null;
        resultDepth = 0;
    };

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index]!;
        const trimmed = line.trim();
        if (resultLines) {
            resultLines.push(line);
            resultDepth += depth(line);
            if (resultDepth <= 0) finish();
            continue;
        }
        if (trimmed === "{" && /^\s*"success"\s*:/.test(lines[index + 1] ?? "")) continue;
        const field = trimmed.match(/^"(success|output|result|return|error)"\s*:\s*([\s\S]*?)(?:,)?$/);
        if (!field) {
            if (trimmed !== "}") output.push(line);
            continue;
        }
        const [, key, raw = ""] = field;
        if (key === "success") continue;
        if (key === "error") {
            const message = parse(raw);
            if (message !== null && message !== false && message !== "") {
                return { output, results, error: { message: formatValue(message) } };
            }
            continue;
        }
        if (key === "return") {
            resultLines = [raw];
            resultDepth = depth(raw);
            if (resultDepth <= 0) finish();
            continue;
        }
        const item = parse(raw);
        if (item !== null && item !== "") output.push(formatReplValue(item));
    }
    finish();
    return { output: output.map(item => item.trim()).filter(Boolean), results };
}

function replResult(command: string, value: unknown): ReplResult | null {
    if (!isReplCommand(command) || typeof value !== "string") return null;
    const text = cleanText(value).trimEnd();
    const envelopes = parseJsonObjects(text).filter(({ value: envelope }) =>
        typeof envelope.success === "boolean" && ["output", "result", "return", "error"].some(key => Object.hasOwn(envelope, key)),
    );
    if (envelopes.length === 0) {
        const fragment = replFragment(text);
        if (!fragment) return null;
        const result = fragment.results.length === 1 ? fragment.results[0] : fragment.results.length > 1 ? fragment.results : undefined;
        return {
            output: fragment.output.join("\n") || (result === undefined ? "(no output)" : undefined),
            result,
            resultLabel: fragment.results.length > 1 ? "Results" : undefined,
            error: fragment.error,
        };
    }

    const output: string[] = [];
    const returns: unknown[] = [];
    const build = (error?: ToolError): ReplResult => {
        const result = returns.length === 1 ? returns[0] : returns.length > 1 ? returns : undefined;
        return {
            output: output.join("\n") || (result === undefined && !error ? "(no output)" : undefined),
            result,
            resultLabel: returns.length > 1 ? "Results" : undefined,
            error,
        };
    };
    let cursor = 0;
    for (const envelope of envelopes) {
        const prefix = text.slice(cursor, envelope.start).trim();
        const fragment = replFragment(prefix);
        if (fragment) {
            output.push(...fragment.output);
            returns.push(...fragment.results);
            if (fragment.error) return build(fragment.error);
        } else if (prefix) output.push(prefix);
        const value = Object.hasOwn(envelope.value, "output") ? envelope.value.output : envelope.value.result;
        if (value !== undefined && value !== null && value !== "") output.push(formatReplValue(value));
        if (Object.hasOwn(envelope.value, "return") && envelope.value.return !== undefined && envelope.value.return !== null) {
            returns.push(envelope.value.return);
        }
        const error = semanticError(envelope.value);
        if (error) return build(error);
        cursor = envelope.end;
    }
    const suffix = text.slice(cursor).trim();
    const fragment = replFragment(suffix);
    if (fragment) {
        output.push(...fragment.output);
        returns.push(...fragment.results);
        if (fragment.error) return build(fragment.error);
    } else if (suffix) output.push(suffix);
    return build();
}

// ---------------------------------------------------------------- sections

function toolSections(message: types.agent.Message, kind: string): Section[] {
    if (kind === "read") return readSections(message);
    if (kind === "search") return searchSections(message);
    if (kind === "edit") return editSections(message);
    // Delete and move fall back to the raw input/output pair, the way wmlet does:
    // both often carry nothing but the paths, and an empty row says less.
    if (kind === "delete") return fallback(deleteSections(message), message);
    if (kind === "move") return fallback(moveSections(message), message);
    if (kind === "think") return thinkSections(message);
    if (kind === "fetch") return fetchSections(message);
    if (kind === "execute") return executeSections(message);
    return genericSections(message);
}

function fallback(sections: Section[], message: types.agent.Message): Section[] {
    return sections.length > 0 ? sections : genericSections(message);
}

function readSections(message: types.agent.Message): Section[] {
    const input = record(message.data?.rawInput);
    const paths = toolPaths(message, input?.file_path, input?.path);
    const split = splitNotices(message.text ?? "");
    const content = split.content || (split.notices.length === 0 ? toolResult(message, "(empty file)") : undefined);
    return keep([
        section("File", paths.join("\n")),
        section(message.status === "failed" ? "Error" : "Content", content),
        section("Notice", split.notices.join("\n")),
    ]);
}

function searchSections(message: types.agent.Message): Section[] {
    const input = record(message.data?.rawInput);
    const commands = parsedCommands(message.data?.rawInput);
    const patterns = [
        typeof input?.pattern === "string" ? input.pattern : undefined,
        ...commands.map(command => (typeof command.query === "string" ? command.query : undefined)),
    ].filter((value): value is string => Boolean(value));
    const paths = toolPaths(message, input?.path, ...commands.map(command => (typeof command.path === "string" ? command.path : undefined)));
    return keep([
        section("Pattern", [...new Set(patterns)].join("\n")),
        section("Path", paths.join("\n")),
        section(message.status === "failed" ? "Error" : "Result", toolResult(message, "No matches")),
    ]);
}

// The diff is rebuilt from the edit's own arguments: procs keeps one row per
// tool, so the ACP diff content blocks are gone by the time this renders.
function editSections(message: types.agent.Message): Section[] {
    const input = record(message.data?.rawInput);
    const paths = toolPaths(message, input?.file_path, input?.path);
    const path = paths[0];
    const diffs: Diff[] = [];
    if (path) {
        if (typeof input?.content === "string") diffs.push({ path, oldText: null, newText: input.content });
        else if (typeof input?.old_string === "string" || typeof input?.new_string === "string") {
            diffs.push({
                path,
                oldText: typeof input.old_string === "string" ? input.old_string : null,
                newText: typeof input.new_string === "string" ? input.new_string : null,
            });
        }
    }
    const diff = diffSection(diffs);
    if (diff && message.status === "failed") diff.label = "Attempted diff";
    const text = cleanText(message.text ?? "").trim();
    const result = text || (message.status === "failed" && message.data?.incomplete !== true ? "Tool failed" : undefined);
    return keep([
        section("File", paths.join("\n")),
        diff,
        section(message.status === "failed" ? "Error" : "Content", result),
    ]);
}

function deleteSections(message: types.agent.Message): Section[] {
    const input = record(message.data?.rawInput);
    const paths = toolPaths(message, input?.file_path, input?.path, input?.target);
    return keep([
        section("File", paths.join("\n")),
        ...resultSections(message.status === "failed" ? "Error" : "Result", toolResult(message, "(no output)")),
    ]);
}

function moveSections(message: types.agent.Message): Section[] {
    const input = record(message.data?.rawInput);
    const locations = toolPaths(message);
    return keep([
        section("Source", input?.source ?? input?.source_path ?? input?.from ?? locations[0]),
        section("Destination", input?.destination ?? input?.destination_path ?? input?.to ?? locations[1]),
        ...resultSections(message.status === "failed" ? "Error" : "Result", toolResult(message, "(no output)")),
    ]);
}

function thinkSections(message: types.agent.Message): Section[] {
    const input = record(message.data?.rawInput);
    return keep([
        section("Prompt", typeof input?.prompt === "string" ? input.prompt : undefined),
        section("Thought", toolResult(message, "")),
    ]);
}

// One shape covers both web tools: a `query` means a search, a `url` a fetch.
function fetchSections(message: types.agent.Message): Section[] {
    const input = record(message.data?.rawInput);
    const label = message.status === "failed" ? "Error" : "Result";
    if (typeof input?.query === "string") {
        const domains = (key: string) => (Array.isArray(input?.[key]) ? (input[key] as unknown[]).filter((item): item is string => typeof item === "string") : []);
        return keep([
            section("Query", input.query),
            section("Allowed domains", domains("allowed_domains").join("\n")),
            section("Blocked domains", domains("blocked_domains").join("\n")),
            ...resultSections(label, toolResult(message, "(no result)")),
        ]);
    }
    return keep([
        section("URL", input?.url),
        section("Prompt", input?.prompt),
        ...resultSections(label, toolResult(message, "(no result)")),
    ]);
}

function executeSections(message: types.agent.Message): Section[] {
    const result = toolResult(message, "(no output)");
    const repl = replResult(toolCommand(message.data?.rawInput), result);
    const error = repl?.error ?? semanticError(repl?.output) ?? semanticError(repl?.result) ?? semanticError(result);
    if (error) {
        return keep([
            section("Command", rawInputWithoutMetadata(message.data?.rawInput)),
            ...errorSections(
                error,
                repl?.output && repl.output !== "(no output)" ? repl.output : error.output,
                repl?.result ?? error.result,
                repl?.resultLabel ?? "Result",
            ),
        ]);
    }
    return keep([
        section("Command", rawInputWithoutMetadata(message.data?.rawInput)),
        section(message.status === "failed" && message.data?.incomplete !== true ? "Error" : "Output", repl ? repl.output : result),
        repl ? section(repl.resultLabel ?? "Result", repl.result) : null,
    ]);
}

function genericSections(message: types.agent.Message): Section[] {
    return keep([
        section("Input", message.data?.rawInput),
        ...resultSections(message.status === "failed" ? "Error" : "Output", toolResult(message, "(no output)")),
    ]);
}

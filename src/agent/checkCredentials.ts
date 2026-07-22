// Is this agent logged in? A gate, not a chooser — start refuses to open a
// session without credentials so the user gets "log in" instead of a protocol
// error. Deliberately uncached: someone may log in while the workspace runs.
//
// Claude keeps its token in a file in a container but in the macOS Keychain on a
// developer's machine, so both are checked. When neither can answer we return
// true and let the agent itself refuse — a false "log in" is worse than a
// protocol error, and runPrompt classifies the real one anyway.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export default function (ctx: Context, _session: Session | null, opts?: { id?: "claude" | "codex" }): boolean {
    const config = ctx.fns.config.resolve({ module: "agent" }) as ConfigOf<typeof import("./$config").default>;
    const id = opts?.id ?? config.id;

    if (id === "codex") {
        try {
            return !!JSON.parse(readFileSync(join(config.codexHome, "auth.json"), "utf-8")).tokens?.access_token;
        } catch {
            return false;
        }
    }

    try {
        return !!JSON.parse(readFileSync(join(config.claudeConfigDir, ".credentials.json"), "utf-8")).claudeAiOauth?.accessToken;
    } catch {
        // no file — fall through to the Keychain
    }

    if (process.platform !== "darwin") return true;
    const keychain = Bun.spawnSync(["security", "find-generic-password", "-s", "Claude Code-credentials", "-w"]);
    return keychain.exitCode !== 0 || keychain.stdout.length > 0;
}

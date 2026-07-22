// A resolved service declaration — what workspace.json said, with every default
// filled in and every sugar normalised (a string `cmd` is already `sh -lc`, a
// single `portEnv` is already a list). `resolve` is the only place that builds
// one, so nothing downstream has to ask "and if this is missing?".
//
// Absent `cmd` and `url` is impossible here: such a declaration is a request and
// was answered by the `service.<provider>` hook before it got this far. Absent
// `cmd` *with* a `url` is an external service — someone else runs it, we only
// publish the address.
export type Spec = {
    cmd?: string[];
    url?: string;
    provider?: string;
    dir: string;
    portEnv: string[];
    urlEnv?: string;
    env: Record<string, string>;
    publish: Record<string, string>;
    needs: string[];
    // No probe at all (`{}`) means ready as soon as it is spawned. `timeout`
    // bounds a *dependent's* waiting, never the probe itself.
    ready: { http?: string; tcp?: true; log?: string; timeout: number; period: number };
    restart: "never" | "on-failure" | "always";
    backoff: number;
    maxRestarts: number;
    autostart: boolean;
};

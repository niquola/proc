// Functional tests for the supervisor: a real workspace.json in a temp dir, real
// child processes, no server. What is checked is what a manifest promises —
// defaults, the rules a broken manifest must break on, `needs` as a start gate,
// and the difference between a crash (backoff, then a cap) and a restart.
import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testCtx } from "./$test";

const dirs: string[] = [];
const ctxs: Context[] = [];

// A workspace of its own per test: the manifest is a file, so two tests must not
// share the directory it lives in.
async function workspace(services: Record<string, any>, env?: Record<string, string>): Promise<Context> {
    const dir = mkdtempSync(join(tmpdir(), "services-test-"));
    dirs.push(dir);
    writeFileSync(join(dir, "workspace.json"), JSON.stringify({ env, services }));
    const ctx = await testCtx();
    ctx.env.WORKDIR = dir;
    ctxs.push(ctx);
    return ctx;
}

async function until(check: () => boolean, ms = 5000): Promise<boolean> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
        if (check()) return true;
        await Bun.sleep(20);
    }
    return check();
}

afterAll(async () => {
    for (const ctx of ctxs) {
        await Promise.all(Object.keys(ctx.state.services ?? {}).map(name => ctx.fns.services.stop({ name })));
    }
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

test("resolve fills every default and normalises the sugar", async () => {
    const ctx = await workspace({
        app: { cmd: "bun run dev", portEnv: "PORT" },
        db: { url: "postgres://localhost:5432", needs: [] },
    });
    const specs = await ctx.fns.services.resolve({});

    expect(specs.app).toMatchObject({
        cmd: ["/bin/sh", "-lc", "bun run dev"],
        dir: ".",
        portEnv: ["PORT"],
        needs: [],
        // A service the workspace gave a port to is ready when something listens.
        ready: { tcp: true, timeout: 60, period: 0.5 },
        restart: "on-failure",
        backoff: 1,
        maxRestarts: 5,
        autostart: true,
    });
    // No port, no probe: ready as soon as it is spawned.
    expect(specs.db!.ready).toEqual({ timeout: 60, period: 0.5 });
    expect(specs.db!.cmd).toBeUndefined();
});

test("resolve refuses a manifest that could only fail at runtime", async () => {
    const cycle = await workspace({ a: { cmd: "true", needs: ["b"] }, b: { cmd: "true", needs: ["a"] } });
    await expect(cycle.fns.services.resolve({})).rejects.toThrow(/needs cycle/);

    const collision = await workspace({
        a: { cmd: "true", publish: { SHARED: "1" } },
        b: { cmd: "true", publish: { SHARED: "2" } },
    });
    await expect(collision.fns.services.resolve({})).rejects.toThrow(/published by both/);

    const missing = await workspace({ a: { cmd: "true", needs: ["nobody"] } });
    await expect(missing.fns.services.resolve({})).rejects.toThrow(/not declared/);

    const probes = await workspace({ a: { cmd: "true", portEnv: "P", ready: { tcp: true, log: "up" } } });
    await expect(probes.fns.services.resolve({})).rejects.toThrow(/pick one/);
});

test("env assigns a port per portEnv and interpolates what publishers say", async () => {
    const ctx = await workspace(
        {
            queue: { cmd: "true", portEnv: ["Q_PORT", "Q_DB_PORT"], publish: { Q_ADDRESS: "localhost:${Q_PORT}" } },
            app: { cmd: "true", portEnv: "PORT", urlEnv: "APP_URL" },
        },
        { NODE_ENV: "development" },
    );
    const env = await ctx.fns.services.env({});

    expect(Number(env.Q_PORT)).toBeGreaterThan(1024);
    expect(env.Q_DB_PORT).not.toBe(env.Q_PORT);
    expect(env.Q_ADDRESS).toBe(`localhost:${env.Q_PORT}`);
    expect(env.APP_URL).toBe(`http://localhost:${env.PORT}`);
    expect(env.NODE_ENV).toBe("development");
    // A second call keeps the ports: restarts must come back on the same address.
    expect(await ctx.fns.services.env({})).toEqual(env);
});

test("needs is a start gate: the dependency is started and awaited first", async () => {
    const ctx = await workspace({
        dep: { cmd: "echo listening; sleep 20", ready: { log: "listening", timeout: 5, period: 0.05 }, autostart: false },
        user: { cmd: "sleep 20", needs: ["dep"], autostart: false },
    });
    await ctx.fns.services.track({});
    await ctx.fns.services.start({ name: "user" });

    const dep = ctx.state.services!.dep!;
    const user = ctx.state.services!.user!;
    expect(dep.state).toBe("running");
    expect(dep.ready).toBe(true);
    expect(user.state).toBe("running");
    expect(dep.startedAt!).toBeLessThanOrEqual(user.startedAt!);
    // The ring holds what the child said, tagged with the pipe it came from.
    expect(ctx.fns.services.logs({ name: "dep" })).toMatchObject([{ seq: 1, stream: "out", text: "listening" }]);
});

test("a crash backs off and then gives up; the record survives with the reason", async () => {
    const ctx = await workspace({
        flaky: { cmd: "exit 3", backoff: 0.05, maxRestarts: 2 },
    });
    await ctx.fns.services.track({});
    await ctx.fns.services.start({ name: "flaky" });

    const flaky = ctx.state.services!.flaky!;
    expect(await until(() => flaky.state === "crashed")).toBe(true);
    expect(flaky.exitCode).toBe(3);
    expect(flaky.restarts).toBe(3);
    expect(flaky.error).toBe("gave up after 2 restarts");
    expect(flaky.proc).toBeUndefined();
    // Still declared, still on the list — only the process is gone.
    expect(ctx.fns.services.status({}).find((s: any) => s.name === "flaky")).toMatchObject({ state: "crashed", ready: false });
});

test("a clean exit is not a failure under the default policy", async () => {
    const ctx = await workspace({ once: { cmd: "exit 0", backoff: 0.05 } });
    await ctx.fns.services.track({});
    await ctx.fns.services.start({ name: "once" });

    const once = ctx.state.services!.once!;
    expect(await until(() => once.state === "idle" && once.exitCode === 0)).toBe(true);
    expect(once.restarts).toBe(1);
});

test("stop and restart are not crashes, and restart keeps the port", async () => {
    const ctx = await workspace({ long: { cmd: "sleep 30", portEnv: "LONG_PORT", ready: {} } });
    await ctx.fns.services.track({});
    await ctx.fns.services.start({ name: "long" });

    const long = ctx.state.services!.long!;
    const port = long.port;
    const firstPid = long.pid;
    expect(long.state).toBe("running");

    await ctx.fns.services.restart({ name: "long" });
    expect(long.state).toBe("running");
    expect(long.wanted).toBe("up");
    expect(long.pid).not.toBe(firstPid);
    expect(long.port).toBe(port);
    // A restart is a chore, not a failure — nothing is counted against the cap.
    expect(long.restarts).toBe(0);

    await ctx.fns.services.stop({ name: "long" });
    expect(long.state).toBe("idle");
    expect(long.wanted).toBe("down");
    expect(long.proc).toBeUndefined();
    // Stopped, not forgotten.
    expect(ctx.state.services!.long).toBeDefined();
});

test("track follows the manifest: new services appear, gone ones are dropped", async () => {
    const ctx = await workspace({ a: { cmd: "true" } });
    await ctx.fns.services.track({});
    expect(Object.keys(ctx.state.services!)).toEqual(["a"]);

    writeFileSync(join(ctx.env.WORKDIR!, "workspace.json"), JSON.stringify({ services: { b: { cmd: "true" } } }));
    await ctx.fns.services.track({});
    expect(Object.keys(ctx.state.services!)).toEqual(["b"]);
});

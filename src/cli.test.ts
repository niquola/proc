import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("cli.parse: command + --flags + positionals", () => {
    // schemaless: `--k v` takes a value; a trailing `--flag` (no following value) is boolean
    expect(ctx.fns.cli.parse({ argv: ["db:seed", "--n", "5", "x", "--force"] }))
        .toEqual({ command: "db:seed", opts: { _: ["x"], n: "5", force: true } });
});

test("cli.run: dispatches $cli_<command> (fns) and help", async () => {
    const out = await ctx.fns.cli.run({ argv: ["fns"] });
    expect(Array.isArray(out)).toBe(true);
    expect(out.some((f: string) => f.startsWith("ctx.fns."))).toBe(true);

    const help = await ctx.fns.cli.run({ argv: [] });
    expect(help.commands).toContain("fns");
    expect(help.commands).toContain("migrate");
});

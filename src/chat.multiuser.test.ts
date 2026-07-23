// FUNCTIONAL test: several people, one agent, one transcript. The rules that
// matter are the ones a single-user test cannot see — presence is counted per
// connection, and a name appears only once there is more than one voice.
import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();
// A request ctx with somebody on it — the same shape http/$start builds, so
// join reads the session exactly as it does in the server.
const as = (sub: string, name: string) => Object.assign(Object.create(ctx), { session: { user: { sub, name } } }) as Context;

test("presence counts connections, so a second tab is not a second person", () => {
    const annaTab1 = as("anna", "Anna").fns.events.join({});
    const annaTab2 = as("anna", "Anna").fns.events.join({});
    const niquola = as("niquola", "niquola").fns.events.join({});

    expect(ctx.fns.events.presence({})).toEqual([
        { id: "anna", name: "Anna", tabs: 2 },
        { id: "niquola", name: "niquola", tabs: 1 },
    ]);

    annaTab1();                                    // one tab closes — Anna is still here
    expect(ctx.fns.events.presence({}).map(p => `${p.id}:${p.tabs}`)).toEqual(["anna:1", "niquola:1"]);

    annaTab1();                                    // and a repeated close does not double-count
    annaTab2();
    niquola();
    expect(ctx.fns.events.presence({})).toEqual([]);
});

test("a bubble is anonymous alone and named in company", () => {
    const alone = { id: "1", seq: 1, role: "user", kind: "text", text: "hi", at: "", updatedAt: "" } as any;
    expect(ctx.fns.chat.bubble({ message: { ...alone, author: { id: "anna", name: "Anna" } } })).not.toContain("Anna");
    expect(ctx.fns.chat.bubble({ message: { ...alone, author: { id: "anna", name: "Anna" } }, showAuthor: true })).toContain("Anna");
});

test("the bar stays empty until somebody else is here", () => {
    expect(ctx.fns.chat.who({})).not.toContain("<span");
});

// Tell the agent about the live runtime by writing a managed block at the top
// of the workdir's CLAUDE.md. Ports and function lists change per run, so the
// block is regenerated on every agent start and replaced in place between its
// markers — everything the project itself wrote is left untouched.
const START = "<!-- workspace-runtime:start -->";
const END = "<!-- workspace-runtime:end -->";

export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<string> {
    const file = `${ctx.fns.project.workdir({})}/CLAUDE.md`;
    const existing = await Bun.file(file).text().catch(() => "");
    const block = `${START}\n${section(ctx)}${END}`;

    const from = existing.indexOf(START);
    const to = existing.indexOf(END);
    // Goes first: the runtime is what the agent should read before the project's
    // own instructions, and it is rewritten on every start.
    const next = from !== -1 && to !== -1
        ? existing.slice(0, from) + block + existing.slice(to + END.length)
        : block + "\n\n" + existing.trimStart();

    await Bun.write(file, next);
    return file;
}

function section(ctx: Context): string {
    const services = ctx.fns.services.status({});
    const port = ctx.fns.config.resolve({ module: "http" }).port;
    const app = services.find((s: any) => s.name === "app");
    const env = ctx.state.serviceEnv ?? {};
    const rows = services.map((s: any) =>
        `| \`${s.name}\` | ${s.url ?? (s.port ? `http://localhost:${s.port}` : "—")} | ${s.running ? "running" : "stopped"} | ${s.cmd?.join(" ") || "external"} |`).join("\n");
    const envRows = Object.entries(env)
        .filter(([k]) => !k.includes("LICENSE"))
        .map(([k, v]) => `\`${k}=${v}\``).join(" · ");

    return `# Workspace runtime

You are working inside a **live workspace**: the services below are already
running, supervised by a workspace process on port ${port}. Ports are assigned per
run — read them here or from \`services.status\`, never hardcode them.

| service | address | state | command |
|---|---|---|---|
${rows}

Environment injected into every service: ${envRows || "—"}

## The two REPLs

Both the workspace and the app expose \`POST /repl\`: the body is TypeScript that
runs **inside that running process**, with its \`ctx\` in scope. The last expression
is the return value, \`print(...)\` is captured as output, and the response is
\`{ success, output, return }\`. Nothing restarts, nothing is rebuilt.

Reach for this **before** re-reading code, adding \`console.log\`, or restarting a
service: it answers "what does the process actually hold right now?" in one call.
Both endpoints are loopback-only.

Two generated helpers in the workdir take the code as an argument or on stdin,
so nothing has to be quoted inside \`curl\`:

\`\`\`sh
.workspace/repl 'ctx.fns.services.status({})'${app ? `
.workspace/app-repl 'Object.keys(ctx.fns)'` : ""}

.workspace/repl <<'EOF'
const services = ctx.fns.services.status({});
print(services.length + " services");
services.map(s => s.name)
EOF
\`\`\`

The plain form works too: \`curl -s localhost:${port}/repl --data-binary '<code>'\`.

## Workspace functions (port ${port})

Namespaces: ${Object.keys(ctx.state.registry).sort().map(n => `\`${n}\``).join(", ")}.

\`\`\`sh
# what is running, on which ports, with which env
.workspace/repl 'ctx.fns.services.status({})'
.workspace/repl 'await ctx.fns.services.env({})'

# logs of a service (ring buffer, no files to tail)
.workspace/repl 'ctx.fns.services.logs({ name: "app", lines: 80 })'

# lifecycle — restart keeps the same ports, stop/start are per service
.workspace/repl 'await ctx.fns.services.restart({ name: "app" })'

# what the workspace considers the project and its plugins
.workspace/repl 'ctx.fns.project.workdir({})'
.workspace/repl 'await ctx.fns.services.resolve({})'
\`\`\`
${app ? `
## App functions (port ${app.port})

\`\`\`sh
# the app's own registry — what you can call in it
.workspace/app-repl 'Object.keys(ctx.fns)'

# the env the workspace injected, as the process sees it
.workspace/app-repl 'print(ctx.env.AIDBOX_BASE_URL); ctx.env.PORT'

# talk to Aidbox with the credentials it was given
.workspace/app-repl <<'EOF'
const r = await fetch(ctx.env.AIDBOX_BASE_URL + "/fhir/Patient?_count=1", {
  headers: { authorization: "Basic " + btoa(ctx.env.AIDBOX_CLIENT_ID + ":" + ctx.env.AIDBOX_CLIENT_SECRET) },
});
({ status: r.status, total: (await r.json()).total })
EOF
\`\`\`

Write code to a file first, then load it into the running app — do not paste
large sources into the REPL:

\`\`\`sh
.workspace/app-repl 'await ctx.fns.dev.sync({ rel: "patients/count.ts" })'
.workspace/app-repl 'ctx.fns.patients.count({})'
\`\`\`
` : ""}
## Driving the UI

The workspace UI is open in a browser. The workspace can inject JS into that
page over its event stream and read the result back — there is no browser here
to automate, the user's own tab is the runtime.

\`\`\`sh
# which plugin tabs exist and which one is showing
.workspace/repl 'await ctx.fns.page.tabs({})'

# switch the right pane (URL changes, chat and streams stay alive)
.workspace/repl 'await ctx.fns.page.openTab({ plugin: "processes" })'
.workspace/repl 'await ctx.fns.page.open({ url: "/filemanager?path=src" })'

# read what the user is looking at
.workspace/repl 'await ctx.fns.page.text({ selector: "#main" })'

# interact
.workspace/repl 'await ctx.fns.page.click({ selector: "a[href=\\"/preview\\"]" })'
.workspace/repl 'await ctx.fns.page.fill({ selector: "input[name=url]", value: "http://localhost:3000" })'

# anything else: the code is the body of an async function in the tab
.workspace/repl 'await ctx.fns.page.eval({ code: "return document.title" })'
\`\`\`

Use this to show the user what you are talking about — open the file you just
changed, switch to the processes tab after restarting a service — and to check
that a change actually rendered.

## Asking the user with a form

When you need structured input, do not ask for it in prose — put a real form in
front of the user. \`form.ask\` stores the form, opens it in the right pane, and
the submitted values come back to you **as a chat message**, so just wait for
them instead of polling.

\`\`\`sh
.workspace/repl <<'EOF'
await ctx.fns.form.ask({
  title: "Новый пациент",
  fields: [
    { name: "name", label: "Имя", required: true },
    { name: "birthDate", label: "Дата рождения", type: "date" },
    { name: "gender", label: "Пол", type: "select", options: ["male", "female", "other"] },
    { name: "note", label: "Заметка", type: "textarea" },
  ],
})
EOF
\`\`\`

Field types: \`text\` (default), \`textarea\`, \`number\`, \`date\`, \`select\` (with
\`options\`), \`checkbox\`; \`value\` prefills, \`required\` validates. Answered forms
stay readable at \`/form\`.

## Interacting with the UI by data-* attributes

Every control the workspace renders carries \`data-form\`, \`data-action\` or
\`data-entity\`+\`data-id\` — address those, never CSS selectors, so a restyle does
not break you.

\`\`\`sh
.workspace/repl 'await ctx.fns.page.fill({ form: "1", values: { name: "Иван", gender: "male" } })'
.workspace/repl 'await ctx.fns.page.submit({ form: "1" })'
.workspace/repl 'await ctx.fns.page.click({ action: "restart", entity: "service", id: "app" })'
.workspace/repl 'await ctx.fns.page.click({ entity: "file", id: "src" })'
\`\`\`

Fill it in yourself only when demonstrating or testing — a form meant for the
user is theirs to submit.

## Rules

- Check runtime state through the REPL instead of guessing from source.
- Navigate with \`page.open\` / \`page.openTab\`, never \`location.reload\` — a full
  reload drops the chat, the event stream and this bridge.
- After editing a file the app already loaded, sync it (\`dev.sync\`) rather than
  restarting the process; restart only when the entry point or a \`$start\` changed.
- Never edit this block — the workspace rewrites it on every agent start.

`;
}

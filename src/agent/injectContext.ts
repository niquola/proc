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
    // An in-process app has no port and no second REPL: its functions are in
    // this registry, so the recipes are different ones.
    const inProcess = services.filter((s: any) => s.runtime === "in-process");
    const env = ctx.state.serviceEnv ?? {};
    // `sh -lc` is how a string cmd runs, not what the manifest says — show the line.
    const command = (cmd: string[] = []) => (cmd[0] === "/bin/sh" ? cmd[2] : cmd.join(" ")) || "external";
    const rows = services.map((s: any) =>
        `| \`${s.name}\` | ${s.url ?? "—"} | ${s.state}${s.state === "running" && !s.ready ? " (not ready yet)" : ""} | ${s.restarts} | ${command(s.cmd)} |`).join("\n");
    const envRows = Object.entries(env)
        .filter(([k]) => !k.includes("LICENSE"))
        .map(([k, v]) => `\`${k}=${v}\``).join(" · ");

    return `# Workspace runtime

You are working inside a **live workspace**: the services below are already
running, supervised by a workspace process on port ${port}. Ports are assigned per
run — read them here or from \`services.status\`, never hardcode them.

| service | address | state | restarts | command |
|---|---|---|---|---|
${rows}

A service is **running** once its process is up and **ready** once its probe
passed — \`needs\` in workspace.json waits for the second, not the first.

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

# …and wait for it to answer again before you test against it
.workspace/repl 'await ctx.fns.services.waitReady({ name: "app" })'

# what the workspace considers the project and its plugins
.workspace/repl 'ctx.fns.project.workdir({})'
.workspace/repl 'await ctx.fns.services.resolve({})'
\`\`\`
${inProcess.length ? inProcess.map((s: any) => `
## The app runs in this process (\`ctx.fns.${s.name}.*\`)

\`${s.name}\` is declared \`runtime: "in-process"\`, so there is no child, no port
and no second REPL: its files under \`WORKDIR/src\` are functions in the registry
you are already talking to, and its routes are served at \`/${s.name}/…\`.

The directory is both the path and the namespace; the file name is the rest:

| file | is |
|---|---|
| \`src/patients/search.ts\` | \`ctx.fns.${s.name}.patients.search({…})\` |
| \`src/patients/$route__GET.ts\` | \`GET /${s.name}/patients\` |
| \`src/patients/$route_$id_GET.ts\` | \`GET /${s.name}/patients/:id\` |
| \`src/$route__GET.ts\` | \`GET /${s.name}\` |

\`\`\`sh
# what the app already has
.workspace/repl 'Object.keys(ctx.fns.${s.name} ?? {})'

# call one of its functions — same process, no HTTP
.workspace/repl 'await ctx.fns.${s.name}.patients.search({ count: 3 })'

# after editing a file: reload it, then verify at once
.workspace/repl 'await ctx.fns.dev.sync({ rel: "${s.name}/patients/search.ts" })'

# a NEW file or route needs the fuller reload (routes live on the root ctx)
.workspace/repl <<'EOF'
let root = ctx; while (Object.getPrototypeOf(root) !== Object.prototype) root = Object.getPrototypeOf(root);
await root.loadFns({}); await root.genTypes({}); await root.fns.http.loadRoutes({});
Object.keys(root.routes).filter(r => r.startsWith("/${s.name}"))
EOF

# render a page without a browser
.workspace/repl 'await ctx.fns.http.dispatch({ url: "/${s.name}/patients" }).then(r => r.status)'
\`\`\`

A broken file fails the reload rather than the request: \`dev.sync\` throws with the
error, and the service card goes \`crashed\` with the reason on it.
`).join("") : app ? `
## App functions (port ${app.port})

\`\`\`sh
# the app's own registry — what you can call in it
.workspace/app-repl 'Object.keys(ctx.fns)'

# the env the workspace injected, as the process sees it
.workspace/app-repl 'print(ctx.env.AIDBOX_BASE_URL); ctx.env.PORT'
\`\`\`

Write code to a file first, then load it into the running app — do not paste
large sources into the REPL:

\`\`\`sh
.workspace/app-repl 'await ctx.fns.dev.sync({ rel: "patients/count.ts" })'
.workspace/app-repl 'ctx.fns.patients.count({})'
\`\`\`
` : ""}
## Plugins

Everything the workspace can do beyond the framework is a plugin: one folder
whose functions are a library (\`ctx.fns.<namespace>.*\`), whose \`GET /<namespace>\`
route is a tab, and whose \`SKILL.md\` — when it has one — is the instructions for
using it. Read that file when you need the plugin, not before.

| plugin | is | read |
|---|---|---|
${(ctx.state.plugins ?? []).map((p: any) => `| \`${p.namespace}\` | ${[p.tab && "tab", p.skill && "skill", ...p.provides.map((s: string) => `provides ${s}`), `${p.fns.length} fns`].filter(Boolean).join(", ")} | ${p.skill ?? p.description ?? "—"} |`).join("\n")}

\`\`\`sh
# what is mounted, with each plugin's functions and routes
.workspace/repl 'ctx.fns.plugins.list({})'

# what this machine has that the project has not asked for
.workspace/repl 'await ctx.fns.plugins.catalog({})'

# asking for one writes WORKDIR/workspace.json and mounts it — no restart
.workspace/repl 'await ctx.fns.plugins.add({ name: "fhir-viewer" })'
.workspace/repl 'await ctx.fns.plugins.add({ name: "billing", git: "https://github.com/acme/billing" })'
.workspace/repl 'await ctx.fns.plugins.remove({ name: "billing" })'
\`\`\`

Propose a plugin before adding one — it is the user's project manifest you are
editing, and a new tab appears in front of them.

## Driving the UI

The workspace UI is open in a browser and you can drive it. There is no browser
here to automate — the user's own tab is the runtime, and the workspace injects
JS into it over the event stream and reads the answer back.

**Ask what is on screen before acting.** \`page.state\` reports the right pane in
the vocabulary you may use: the entities, the actions, the forms and their
fields. It is built by the same resolver the verbs use, so a name it reports is
one that will work, and a name it does not report will not.

\`\`\`sh
.workspace/repl 'await ctx.fns.page.state({})'
\`\`\`

Everything is addressed by the \`data-*\` markers a page emits — \`page\`, \`entity\`,
\`id\`, \`status\`, \`role\`, \`form\`, \`action\` — never by a CSS selector, so a restyle
cannot break you.

\`\`\`sh
# navigate. A plugin page keeps its state in its URL, so this is usually enough
.workspace/repl 'await ctx.fns.page.open({ url: "/questionnaire?q=depression" })'
.workspace/repl 'await ctx.fns.page.open({ entity: "questionnaire", id: "44249-1" })'
.workspace/repl 'await ctx.fns.page.openTab({ plugin: "viewdef" })'

# point at something and explain it — the pointer flies there and a caption lands
.workspace/repl 'await ctx.fns.page.point({ action: "materialize" })'
.workspace/repl 'await ctx.fns.page.say({ text: "this rebuilds the table", action: "materialize" })'

# act
.workspace/repl 'await ctx.fns.page.click({ action: "materialize", entity: "viewdef", id: "patient_demographics" })'
.workspace/repl 'await ctx.fns.page.fill({ form: "qr-search", values: { q: "tobacco" } })'
.workspace/repl 'await ctx.fns.page.submit({ form: "qr-search" })'

# read
.workspace/repl 'await ctx.fns.page.text({ selector: "#main" })'
\`\`\`

Every acting verb moves the pointer to its target and lights it up first, so the
user sees what you pressed instead of the page changing on its own. \`show:false\`
turns that off when it would be noise.

### Showing, not telling

When you have found something, put the user in front of it rather than
describing it. A tour is a list of steps against the page they are looking at,
and narration is a step like any other:

\`\`\`sh
.workspace/repl <<'EOF'
await ctx.fns.page.tour({ steps: [
  { open: "/viewdef", say: "These are the SQL-on-FHIR views this project defines" },
  { say: "This one flattens Patient into four columns", entity: "viewdef", id: "patient_demographics" },
  { click: { entity: "viewdef", id: "patient_demographics" }, say: "Its columns, and the rows the table holds" },
  { say: "Press this after editing the file", action: "materialize" },
]})
EOF
\`\`\`

A step may act and narrate at once; the sentence lands on what the act produced.
\`wait\` holds, \`point\` moves the pointer without pressing anything. A failing step
stops the tour and says which one.

## Rules

- Check runtime state through the REPL instead of guessing from source.
- Navigate with \`page.open\` / \`page.openTab\`, never \`location.reload\` — a full
  reload drops the chat, the event stream and this bridge.
- Prefer a URL over a click: \`/questionnaire?q=…\`, \`/viewdef/view?id=…\`,
  \`/filemanager?path=…\` put the user in front of something in one call, and the
  page they end up on is one they can reload or share.
- Ask \`page.state\` rather than guessing an id out of the source; fill a form
  yourself only when demonstrating — one meant for the user is theirs to submit.
- After editing a file the app already loaded, sync it (\`dev.sync\`) rather than
  restarting the process; restart only when the entry point or a \`$start\` changed.
- Never edit this block — the workspace rewrites it on every agent start.

`;
}

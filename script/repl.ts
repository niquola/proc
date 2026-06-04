// CLI client for the server-side REPL.
//   bun script/repl.ts 'ctx.fns.project.scan(ctx)'
//   bun script/repl.ts -f snippet.ts
//   echo 'Object.keys(ctx.fns)' | bun script/repl.ts
const args = process.argv.slice(2);
let code: string;
if (args[0] === "-f" && args[1]) {
    code = await Bun.file(args[1]).text();
} else if (args.length > 0) {
    code = args.join(" ");
} else if (!process.stdin.isTTY) {
    code = await Bun.stdin.text();
} else {
    console.error("Usage: bun script/repl.ts '<code>' | -f <file> | - (stdin)");
    process.exit(1);
}

const portFile = Bun.file(".runtime/port");
if (!(await portFile.exists())) {
    console.error("No .runtime/port — is the server running? (bun src/$main.ts)");
    process.exit(1);
}
const port = (await portFile.text()).trim();

const res = await fetch(`http://localhost:${port}/repl`, {
    method: "POST",
    body: code,
});

const text = await res.text();
try {
    const data = JSON.parse(text);
    console.log(JSON.stringify(data, null, 2));
    if (!res.ok || data.error) process.exit(1);
} catch {
    console.log(text);
    if (!res.ok) process.exit(1);
}

// Standalone entry — run the app from THIS folder: `bun index.ts`.
// proc is the framework dependency; boot scans this app's src/ + proc's core
// and starts the modules declared in this package.json proc.prod.
// (In a published app this is `import { boot } from "proc"`.)
import { boot } from "../../src/$main";

await boot({ root: import.meta.dir });

# proc plugins

A plugin is a package (local dir, npm package, or git repo) that contributes functions, routes and types into the host's **one shared `ctx.fns`**, under a namespace it declares. Plugin code is first-class: it uses the same `(ctx, session, opts)` signature and the same file-name conventions, and it calls core fns (and other plugins) through `ctx.fns.*`.

## Authoring a plugin

A plugin is just a package with a `proc` field in its `package.json` and a `src/` tree of proc functions:

```jsonc
// proc-auth/package.json
{
  "name": "proc-auth",
  "version": "1.0.0",
  "proc": { "namespace": "auth", "src": "src" },   // src defaults to "src"
  "dependencies": { "nanoid": "^5" }                // pulled by bun when installed
}
```

```ts
// proc-auth/src/login.ts → mounts at ctx.fns.auth.login
export default async function (ctx: Context, session: Session, opts: { user: string }) { ... }
// proc-auth/src/jwt/sign.ts        → ctx.fns.auth.jwt.sign
// proc-auth/src/$route_login_POST.ts → POST /auth/login   (namespace-prefixed)
// proc-auth/src/$type_Token.ts       → types.auth.Token
```

The namespace must be a valid identifier and must not collide with a core module or another plugin — `dev.lint` rejects collisions (a name is either a function or a namespace). The plugin's `Context`/`Session` types come from the host (global), so no imports between plugin and core — only `ctx.fns` calls.

## Using plugins in a host project

Declare them in the **host** `package.json`; `from` is exactly what `bun add` takes:

```jsonc
// host package.json
{ "proc": { "plugins": [
    { "from": "proc-auth" },                  // npm
    { "from": "github:acme/proc-billing" },   // git
    { "from": "file:./examples/hello" }        // local path
] } }
```

Then `bun install` (pulls every plugin's deps too), and boot mounts them automatically. Or install + mount one **on the fly**, no restart:

```ts
ctx.fns.plugins.add({ from: "proc-auth" })   // bun add → persist in package.json → remount (dev only)
ctx.fns.plugins.list({})                      // [{ namespace, dir, fns, routes, types }]
ctx.fns.plugins.remove({ from: "proc-auth" }) // drop the declaration → remount
```

## How it works

`project/roots.ts` resolves each plugin's directory (local path, or `node_modules/<pkg>` via Bun's resolver) and reads its `proc` manifest. `project/scan.ts` prefixes the namespace onto each plugin file's path before `classify`, while pointing `abs` at the real file — so everything downstream (loadFns, genTypes, lint, loadRoutes, manifest/build) treats plugin code exactly like first-party code, just namespaced. The prod build (`dev.build`) reaches plugin files by relative import, so a single `dist/app.js` includes all plugins.

A broken/unresolvable plugin is logged and skipped — it never kills boot. `plugins.add` loads third-party code, so it's gated to dev (`NODE_ENV !== production`).

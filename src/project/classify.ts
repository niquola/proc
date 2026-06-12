import { basename, dirname } from "node:path";

const METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

export type ProjectEntry =
    | { kind: "fn"; rel: string; moduleDir: string; fileName: string; runtimeName: string }
    | { kind: "type"; rel: string; moduleDir: string; fileName: string; typeName: string }
    | { kind: "route"; rel: string; moduleDir: string; fileName: string; routePath: string; method: string }
    | { kind: "script"; rel: string; moduleDir: string; fileName: string; routePath: string }
    | { kind: "middleware"; rel: string; moduleDir: string; fileName: string; prefix: string }
    | { kind: "state"; rel: string; moduleDir: string; fileName: string; stateKey: string }
    | { kind: "lifecycle"; rel: string; moduleDir: string; fileName: string; hook: "start" | "stop" }
    | { kind: "config"; rel: string; moduleDir: string; fileName: string }
    | { kind: "skip"; rel: string; moduleDir: string; fileName: string; reason: string };

export default function (_ctx: Context, _session: Session | null, opts: { rel: string }): ProjectEntry {
    const rel = opts.rel;
    const moduleDir = dirname(rel);
    const fileName = basename(rel);

    if (/^\$script_.+\.(js|mjs|css)$/.test(fileName)) {
        const m = /^\$script_(.+?)(\.\w+)$/.exec(fileName);
        if (!m || !m[1] || !m[2]) return { kind: 'skip', rel, moduleDir, fileName, reason: 'bad-script-name' };
        const segs = moduleDir === '.' ? [] : moduleDir.split('/');
        return { kind: 'script', rel, moduleDir, fileName, routePath: '/' + [...segs, m[1] + m[2]].join('/') };
    }

    if (rel.endsWith('.d.ts')) return { kind: 'skip', rel, moduleDir, fileName, reason: 'dts' };
    if (rel.endsWith('.test.ts')) return { kind: 'skip', rel, moduleDir, fileName, reason: 'test' };
    if (rel.endsWith('.entry.ts')) return { kind: 'skip', rel, moduleDir, fileName, reason: 'entry' };
    if (!rel.endsWith('.ts')) return { kind: 'skip', rel, moduleDir, fileName, reason: 'non-ts' };

    const stem = basename(rel, '.ts');
    if (stem === '$main' || stem === '$test') return { kind: 'skip', rel, moduleDir, fileName, reason: 'reserved' };

    if (stem.startsWith('$type_')) {
        const typeName = stem.slice('$type_'.length);
        if (!typeName) return { kind: 'skip', rel, moduleDir, fileName, reason: 'bad-type-name' };
        return { kind: 'type', rel, moduleDir, fileName, typeName };
    }

    if (stem.startsWith('$route_')) {
        const rest = stem.slice('$route_'.length);
        const idx = rest.lastIndexOf('_');
        const pathRaw = idx === -1 ? '' : rest.slice(0, idx);
        const method = idx === -1 ? rest : rest.slice(idx + 1);
        if (!METHODS.has(method)) return { kind: 'skip', rel, moduleDir, fileName, reason: 'bad-route-method' };
        const pathParts = pathRaw === '' ? [] : pathRaw.split('_');
        const moduleSegments = moduleDir === '.' ? [] : moduleDir.split('/');
        const allSegments = [...moduleSegments, ...pathParts].filter(Boolean).map(s => s.startsWith('$') ? ':' + s.slice(1) : s);
        return { kind: 'route', rel, moduleDir, fileName, routePath: '/' + allSegments.join('/'), method };
    }

    // $middleware[_<path>].ts → runs before handlers under its path prefix; may
    // mutate the session. Bare $middleware.ts → the whole module path; the _<path>
    // suffix extends it (_ → /, $id → :id wildcard segment).
    if (stem === '$middleware' || stem.startsWith('$middleware_')) {
        const rest = stem === '$middleware' ? '' : stem.slice('$middleware_'.length);
        const pathParts = rest === '' ? [] : rest.split('_');
        const moduleSegments = moduleDir === '.' ? [] : moduleDir.split('/');
        const segs = [...moduleSegments, ...pathParts].filter(Boolean).map(s => s.startsWith('$') ? ':' + s.slice(1) : s);
        return { kind: 'middleware', rel, moduleDir, fileName, prefix: '/' + segs.join('/') };
    }

    // $state_<key>.ts → declares the type of ctx.state.<key> (the file exports
    // `type <key>`). Types only; the value is set at runtime by fns/middleware.
    if (stem.startsWith('$state_')) {
        const stateKey = stem.slice('$state_'.length);
        if (!stateKey) return { kind: 'skip', rel, moduleDir, fileName, reason: 'bad-state-name' };
        return { kind: 'state', rel, moduleDir, fileName, stateKey };
    }

    // $start.ts / $stop.ts → module lifecycle hooks (init / teardown of ctx),
    // run by ctx.fns.lifecycle.* in the order declared in package.json proc.prod.
    if (stem === '$start' || stem === '$stop') {
        return { kind: 'lifecycle', rel, moduleDir, fileName, hook: stem.slice(1) as 'start' | 'stop' };
    }

    // $config.ts → a module's config schema (default-exports a ConfigSchema).
    // Collected into ctx.state.configSchemas; modules never import it — they
    // read config via ctx.fns.config.resolve({ module }).
    if (stem === '$config') return { kind: 'config', rel, moduleDir, fileName };

    const runtimeName = stem.startsWith('$') ? stem.slice(1) : stem;
    return { kind: 'fn', rel, moduleDir, fileName, runtimeName };
}

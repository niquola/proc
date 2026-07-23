// One record per MOUNTED plugin, built by loadFns and read by everything else:
// the tab strip, the plugin manager and the block the agent gets. A plugin is a
// folder with up to four faces, and none of them is declared — they are read off
// the files it ships:
//   library   always      its fns are ctx.fns.<namespace>.*
//   devtool   tab         it answers GET /<namespace>
//   skill     skill       it ships a SKILL.md
//   provider  provides    it has a $hook_service.<name>.ts
//   viewer    preview     its manifest claims a file pattern, and the file manager
//                         calls the named fn instead of showing text
export type plugins = Array<{
    namespace: string;
    label: string;
    icon: string;
    description: string;
    source: "core" | "project" | "platform" | "external";
    optional: boolean;            // waits to be named in workspace.json, and can be removed
    from: string | null;                // the git url / path an external came from
    dir: string;                        // the plugin folder — manifest and SKILL.md live here
    config: Record<string, any>;        // what workspace.json passed under this name
    skill: string | null;
    tab: boolean;
    client: boolean;              // ships a client.js the layout loads
    fns: string[];
    routes: string[];
    provides: string[];
    preview: { files: string; fn: string } | null;
}>;

import { resolve } from "node:path";

export default async function (_ctx: Context, _session: Session | null, _opts?: {}) {
    const srcDir = resolve(import.meta.dir, "..");
    const roots = [{ name: "src", dir: srcDir }];
    const out: Array<{ name: string; dir: string }> = [];
    for (const root of roots) {
        const exists = await Bun.file(root.dir).stat().then(() => true).catch(() => false);
        if (exists) out.push(root);
    }
    return out;
}

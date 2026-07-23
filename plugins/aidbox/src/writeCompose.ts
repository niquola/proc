// Put the generated compose file somewhere per-workspace and stable: the same
// WORKDIR gets the same file and therefore the same docker project and the same
// named volume, so a restart keeps the database while another workspace on this
// machine gets its own.
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{ file: string; project: string }> {
    const workdir = ctx.fns.project.workdir({});
    const project = `aidbox-${createHash("sha1").update(workdir).digest("hex").slice(0, 8)}`;
    const dir = `${tmpdir()}/workspace-${project}`;

    await mkdir(dir, { recursive: true });
    const file = `${dir}/docker-compose.yaml`;
    await Bun.write(file, ctx.fns.aidbox.compose({ project }));
    return { file, project };
}

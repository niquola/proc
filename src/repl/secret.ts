// The one credential that lets code run inside this process. It is generated
// per run and written next to the port so a client on this machine can read it —
// which is the point: the REPL is for whoever already has the filesystem, not
// for whoever reached the port.
//
// The loopback check alone stopped being enough the moment a workspace can sit
// behind a proxy: `kubectl port-forward` and nginx both make every request look
// like 127.0.0.1, and then the eval endpoint is open to everything that reaches
// the proxy. The secret survives that, because a proxy does not have the file.
import { chmod } from "node:fs/promises";

export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<string> {
    if (ctx.state.replSecret) return ctx.state.replSecret;
    ctx.state.replSecret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
    await Bun.write(".runtime/repl-secret", ctx.state.replSecret);
    await chmod(".runtime/repl-secret", 0o600).catch(() => { /* an fs without modes */ });
    return ctx.state.replSecret;
}

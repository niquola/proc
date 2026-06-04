import { resolve } from "node:path";

export default async function () {
    const path = resolve(import.meta.dir, "client.js");
    return new Response(await Bun.file(path).text(), { headers: { 'content-type': 'application/javascript; charset=utf-8' } });
}

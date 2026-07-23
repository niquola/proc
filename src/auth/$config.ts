// Whether the web UI is behind a login, and what verifies a token.
//
// `off` is the default and means exactly today's behaviour: the workspace is a
// developer's own process on their own machine and the perimeter is the port it
// listens on. `on` puts every page, the event stream and every POST behind a
// session — for a workspace that is reachable by anyone else.
export default {
    mode: { type: "string", default: "off", env: "AUTH" },                 // off | on
    // Who the locally-minted token is for. The OS user by default, because the
    // link printed at boot is for the person sitting here.
    user: { type: "string", default: "", env: "AUTH_USER" },
    // A token this workspace signs is good for this long. Long, because losing a
    // session mid-work is worse than a stale token on a machine someone already
    // has the filesystem of.
    days: { type: "integer", default: 30, env: "AUTH_DAYS" },
    // A manager's public key (SPKI PEM) — when set, tokens it signed are accepted
    // too, which is how this stops being a workspace that only trusts itself.
    publicKey: { type: "string", default: "", env: "AUTH_PUBLIC_KEY" },
} as const satisfies ConfigSchema;

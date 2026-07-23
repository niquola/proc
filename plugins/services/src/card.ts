// One service as a card: everything a human asks about a process, in the order
// they ask it — is it up (dot + chip), how long has it been up, where do I reach
// it, has it been dying (↻ / exit code), what is it actually running (cmd), why
// is it broken (needs · down, error) and what is it saying (the last three log
// lines). Clicking the card loads its logs into #service-log; the three icon
// buttons act and return 204, so nothing here re-renders itself — the supervisor
// emits {type:"service"} and the list refetches.
//
// An external service (no cmd — someone else runs it) gets no buttons: there is
// no process here to start or stop, only an address.
export default function (
    ctx: Context,
    _session: Session | null,
    opts: { service: types.services.Service; selected: boolean },
): string {
    const service = opts.service;
    const esc = (text: unknown) => ctx.fns.processes.escape({ text });
    const external = !service.spec.cmd;
    const name = encodeURIComponent(service.name);

    // `sh -lc` is how a string cmd is run, not what the human wrote — show the
    // line from workspace.json, not the wrapper resolve put around it.
    const argv = service.spec.cmd ?? [];
    const cmd = argv[0] === "/bin/sh" ? argv[2] : argv.join(" ");
    const address = service.url ?? (service.port ? `http://localhost:${service.port}` : null);
    const addressLabel = service.port ? `:${service.port}` : service.url;
    // A dependency that is not running is the usual reason a card is red, so the
    // card says which one instead of making the human open the other card.
    const down = (service.spec.needs ?? []).filter(need => ctx.state.services?.[need]?.state !== "running");
    const peek = service.lines.slice(-3);

    const actions = external ? "" : [
        service.state === "running" || service.state === "starting"
            ? `${actionButton(ctx, service.name, "stop", "ph-stop", "Stop")}${actionButton(ctx, service.name, "restart", "ph-arrows-clockwise", "Restart")}`
            : actionButton(ctx, service.name, "start", "ph-play", "Start"),
    ].join("");

    return `<div class="group flex cursor-pointer items-start gap-2 border-b border-l-2 border-border-subtle px-3 py-2 ${opts.selected ? "border-l-brand bg-bg-selected" : "border-l-transparent hover:bg-bg-tertiary"}"
  ${ctx.fns.ui.attr({ entity: "service", id: service.name, status: service.state })}
  hx-get="/processes/${name}/logs" hx-target="#service-log" hx-swap="outerHTML">
  <div class="min-w-0 flex-1">
    <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span class="h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(service)}"></span>
      <span class="truncate text-ui text-text-primary">${esc(service.name)}</span>
      <span ${ctx.fns.ui.attr({ role: "state" })} class="rounded border px-1.5 py-px text-3xs font-medium ${chipClass(service)}">${esc(stateLabel(service))}</span>
${service.startedAt && (service.state === "running" || service.state === "starting")
            ? `      <span ${ctx.fns.ui.attr({ role: "uptime" })} class="text-2xs tabular-nums text-text-tertiary">${esc(formatUptime(Date.now() - service.startedAt))}</span>\n` : ""
        }${address
            ? `      <a ${ctx.fns.ui.attr({ role: "port" })} class="text-2xs tabular-nums text-text-link hover:underline" href="${esc(address)}" target="_blank" hx-on:click="event.stopPropagation()">${esc(addressLabel)} ↗</a>\n` : ""
        }${service.restarts > 0
            ? `      <span ${ctx.fns.ui.attr({ role: "restarts" })} class="text-2xs text-state-warning-fg" title="restarts">↻ ${service.restarts}</span>\n` : ""
        }${service.state === "crashed" && service.exitCode != null
            ? `      <span class="text-2xs text-state-danger-fg">exit ${esc(service.exitCode)}</span>\n` : ""
        }    </div>
${cmd ? `    <div ${ctx.fns.ui.attr({ role: "command" })} class="mt-1 truncate font-mono text-2xs text-text-muted" title="${esc(cmd)}">${esc(cmd)}</div>\n` : ""
        }${down.length > 0 ? `    <div class="mt-1 text-2xs text-state-warning-fg">${down.map(need => `needs ${esc(need)} · down`).join(" · ")}</div>\n` : ""
        }${service.error ? `    <div class="mt-1 text-2xs text-state-danger-fg">${esc(service.error)}</div>\n` : ""
        }${peek.length > 0
            ? `    <div class="mt-1 font-mono text-3xs leading-4 text-text-placeholder">${peek.map(line => `<div class="truncate">${esc(line.text)}</div>`).join("")}</div>\n` : ""
        }  </div>
${actions ? `  <div class="flex shrink-0 items-center gap-0.5 opacity-70 transition group-hover:opacity-100">${actions}</div>\n` : ""
        }</div>`;
}

// The three buttons are identical but for their verb, so they share one shape:
// POST, swap nothing, and keep the click off the card underneath.
function actionButton(ctx: Context, service: string, action: string, icon: string, label: string): string {
    const esc = (text: unknown) => ctx.fns.processes.escape({ text });
    return `<button type="button" ${ctx.fns.ui.attr({ action, id: service })}
      class="inline-flex size-6 items-center justify-center rounded text-text-tertiary hover:bg-bg-quaternary hover:text-text-primary"
      title="${esc(label)}" aria-label="${esc(`${label} ${service}`)}"
      hx-post="/processes/${encodeURIComponent(service)}/${esc(action)}" hx-swap="none" hx-on:click="event.stopPropagation()">
      <i class="ph ${esc(icon)} text-base" aria-hidden="true"></i>
    </button>`;
}

// A process that is alive but has not passed its probe is still coming up, so
// the dot, the chip and the label all read it as starting: green means reachable,
// not merely spawned.
function tone(service: types.services.Service): "success" | "danger" | "warning" | "neutral" {
    if (service.state === "crashed") return "danger";
    if (service.state === "running") return service.ready ? "success" : "warning";
    if (service.state === "starting" || service.state === "restarting") return "warning";
    return "neutral";
}

function dotClass(service: types.services.Service): string {
    const dots = { success: "bg-status-running", danger: "bg-status-error", warning: "bg-status-warning", neutral: "bg-text-placeholder" };
    return dots[tone(service)];
}

function chipClass(service: types.services.Service): string {
    const t = tone(service);
    return `bg-state-${t}-bg border-state-${t}-border text-state-${t}-fg`;
}

function stateLabel(service: types.services.Service): string {
    if (!service.spec.cmd) return "External";
    if (service.state === "running" && !service.ready) return "Starting";
    return `${service.state[0]!.toUpperCase()}${service.state.slice(1)}`;
}

function formatUptime(ms: number): string {
    const seconds = Math.max(0, Math.round(ms / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
}

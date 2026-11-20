// SPDX-License-Identifier: Apache-2.0
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, window } from "herdr";

const INTERVAL = 3000;
const HISTORY = 16;
const MEM_WIDTH = 32;

// Both platforms take a one-second CPU snapshot, then read the latest memory.
// One command per sample, including when the shown space is on a remote core.
const PROBE = String.raw`
set -eu
export LC_ALL=C
case "$(uname -s)" in
  Darwin)
    cpu=$(/usr/sbin/iostat -C -n 0 -c 2 -w 1)
    printf '%s\n' "$cpu" | awk '/^[[:space:]]*[0-9]/ {line=$0} END {
      if (split(line, v, " ") != 6) exit 1
      printf "cpu %.0f %s %s %s\n", 100-v[3], v[4], v[5], v[6]
    }'
    total=$(/usr/sbin/sysctl -n hw.memsize)
    /usr/bin/vm_stat | awk -v total="$total" '
      NR==1 {for (i=1; i<NF; i++) if ($i=="of") size=$(i+1)}
      /^Anonymous pages:/ {anon=$NF; a=1}
      /^Pages wired down:/ {wired=$NF; w=1}
      /^Pages occupied by compressor:/ {compressed=$NF; c=1}
      /^Pages purgeable:/ {purgeable=$NF; p=1}
      END {if (!size || !a || !w || !c || !p) exit 1
        printf "mem %.0f %.0f\n", (anon+wired+compressed-purgeable)*size, total
      }'
    printf 'cores %s\n' "$(/usr/sbin/sysctl -n hw.logicalcpu)"
    boot=$(/usr/sbin/sysctl -n kern.boottime | awk '{sub(/,$/, "", $4); print $4}')
    printf 'up %s\n' "$(( $(date +%s) - boot ))"
    ;;
  Linux)
    { head -n 1 /proc/stat; sleep 1; head -n 1 /proc/stat; cat /proc/loadavg; } | awk '
      NR<=2 && $1=="cpu" {for (i=2; i<=9; i++) total[NR]+=$i; idle[NR]=$5+$6}
      NR==3 {delta=total[2]-total[1]; if (delta<=0) exit 1
        printf "cpu %.0f %s %s %s\n", 100*(1-(idle[2]-idle[1])/delta), $1, $2, $3
      }'
    awk '/^MemTotal:/ {total=$2} /^MemAvailable:/ {available=$2; found=1}
      END {if (!total || !found) exit 1; printf "mem %.0f %.0f\n", (total-available)*1024, total*1024}' /proc/meminfo
    printf 'cores %s\n' "$(getconf _NPROCESSORS_ONLN)"
    awk '{print "up", int($1)}' /proc/uptime
    ;;
  *) exit 1 ;;
esac
# POSIX df reports in 1024-byte blocks. Use the home filesystem for this host.
df -Pk "$HOME" | awk 'END {if (NR>1 && $2 ~ /^[0-9]+$/) printf "disk %.0f %.0f %d\n", $4*1024, $2*1024, $5}'
`;

const clampPercent = n => Math.min(100, Math.max(0, Math.round(n)));

async function sample(on) {
  const result = await exec("sh", ["-c", PROBE], { on, timeout: 4500 });
  if (result.code !== 0) return null;
  const values = {};
  for (const line of result.stdout.trim().split("\n")) {
    const [key, ...fields] = line.trim().split(/\s+/);
    values[key] = fields.map(Number);
  }
  const { cpu, mem, cores, up, disk } = values;
  if (cpu?.length !== 4 || mem?.length !== 2 || !cpu.every(Number.isFinite) ||
      !mem.every(Number.isFinite) || mem[1] <= 0) return null;
  const used = Math.max(0, Math.min(mem[0], mem[1]));
  return { cpu: clampPercent(cpu[0]), load: cpu.slice(1), used, total: mem[1],
    memory: clampPercent(used / mem[1] * 100), cores: cores?.[0], up: up?.[0], disk };
}

const gib = bytes => `${(bytes / 1073741824).toFixed(1)} GiB`;

function details(s, on) {
  const lines = [on ?? "This computer",
    `CPU ${s.cpu}%${s.cores > 0 ? ` of ${s.cores} logical cores` : ""} · load ${s.load.map(n => n.toFixed(2)).join(" ")}`,
    `Memory ${gib(s.used)} of ${gib(s.total)} (${s.memory}%)`];
  if (s.disk?.length === 3 && s.disk.every(Number.isFinite)) {
    const [free, total, used] = s.disk;
    lines.push(`Home disk ${gib(free)} free of ${gib(total)} (${used}% used)`);
  }
  if (Number.isFinite(s.up) && s.up >= 0) {
    const minutes = Math.floor(s.up / 60);
    lines.push(`Up ${Math.floor(minutes / 1440)}d ${Math.floor(minutes / 60) % 24}h ${minutes % 60}m`);
  }
  return lines.join("\n");
}

export class HostUsage {
  constructor(cx) {
    this.host = null;
    this.running = false;
    cx.timer.every(INTERVAL, cx => { if (window()?.active) this.refresh(cx); });
  }

  follow(on, cx) {
    if (on === null && window()?.platform === "windows") { this.host = null; return; }
    if (this.host?.on === on) return;
    this.host = { on, history: [], last: 0, sample: null };
    this.refresh(cx);
  }

  refresh(cx) {
    const host = this.host;
    if (!host || this.running) return;
    this.running = true;
    const started = Date.now();
    cx.spawn(async cx => {
      const next = await sample(host.on).catch(() => null);
      this.running = false;
      if (this.host !== host) { this.refresh(cx); return; }
      const visible = Boolean(host.sample || next);
      if (!next || started - host.last > 2 * INTERVAL) host.history.length = 0;
      if (next) {
        if (host.history.length === HISTORY) host.history.shift();
        host.history.push(next.cpu);
      }
      host.last = started;
      host.sample = next;
      if (visible) cx.notify();
    });
  }

  render(t) {
    const host = this.host;
    if (!host?.sample) return null;
    const s = host.sample;
    const graph = h_flex().w(HISTORY * 3 - 1).h(10).gap(1).items_end().justify_end();
    for (const n of host.history) {
      graph.child(div().w(2).h(Math.max(1, n / 10)).flex_none().rounded(1).bg(n ? t.accent : t.dim));
    }
    const percent = n => div().w(34).flex_none().whitespace_nowrap().text_right().text_color(t.foreground).child(`${n}%`);
    return h_flex().id("workspace-host-usage").gap(12).flex_none().items_center().tooltip(details(s, host.on))
      .child(h_flex().gap(5).items_center().child("CPU").child(graph).child(percent(s.cpu)))
      .child(h_flex().gap(5).items_center().child("MEM")
        .child(div().w(MEM_WIDTH).h(5).rounded(3).bg(t.raised).overflow_hidden()
          .child(div().w(MEM_WIDTH * s.memory / 100).h_full().rounded(3).bg(t.accent)))
        .child(percent(s.memory)));
  }
}

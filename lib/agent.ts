import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { load } from "./credentials.ts";
import { readOutput } from "./output.ts";
import { CLIENT, HOME } from "./runtime.ts";

// Long enough to write a reply, short enough that a wedged turn still ends.
const LAST_WORD = "90s";
const OUT_OF_TIME =
  "You are out of time. Call `finish` now with what you have: what you did," +
  " what you found, and what you did not reach. Do nothing else.";

const UNITS: Record<string, number> = { h: 3600, m: 60, s: 1 };

// Go's duration spelling, which is what term-llm takes.
export function seconds(duration: string): number {
  let total = 0;
  for (const [, count, unit] of duration.matchAll(/(\d+(?:\.\d+)?)([hms])/g)) {
    total += Number(count) * UNITS[unit!]!;
  }
  return total;
}

function run(prompt: string, resume: boolean, timeout: string, turns: string) {
  const credentials = load(process.env.PROVIDER_ENV_FILE, process.env);
  const budget = seconds(timeout);
  const term = [
    `${HOME}/.local/bin/term-llm`,
    "ask",
    "--agent",
    "workflow-agent",
    ...(process.env.PROVIDER ? ["--provider", process.env.PROVIDER] : []),
    "--session-db",
    `${HOME}/session.db`,
    ...(resume ? ["--resume"] : []),
    "--yolo",
    "--text",
    "--stats",
    "--max-turns",
    turns,
    "--timeout",
    timeout,
    prompt,
  ];

  return spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "-u",
      "agent",
      "-w",
      HOME,
      "-e",
      `HOME=${HOME}`,
      "-e",
      `PATH=${HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin`,
      // What the agent's own tools tell it about the time it has left.
      ...(budget
        ? ["-e", `DEADLINE=${Math.floor(Date.now() / 1000) + budget}`]
        : []),
      ...credentials.flatMap((name) => ["-e", name]),
      CLIENT,
      ...term,
    ],
    { stdio: ["ignore", "inherit", "inherit"] }
  ).status;
}

export function ask(prompt: string, resume: boolean): number {
  const temp = process.env.RUNNER_TEMP!;

  // Last turn's output must not be mistaken for this one's. The record goes
  // too: a turn should report what went wrong in it, not again in the next.
  for (const leftover of ["finish.json", "findings.jsonl", "debug"]) {
    rmSync(join(temp, "output", leftover), { force: true, recursive: true });
  }

  let status =
    run(prompt, resume, process.env.AGENT_TIMEOUT!, process.env.MAX_TURNS!) ??
    1;
  if (status !== 0 && readOutput("finish.json") === undefined) {
    // It ran past its time or died mid-turn. One short pass, so the run says
    // something rather than ending in silence.
    console.error(
      "the turn did not finish; asking for a reply with what it has"
    );
    status = run(OUT_OF_TIME, true, LAST_WORD, "2") ?? status;
  }
  readable();
  return status;
}

// term-llm writes its record as the agent, for the agent alone. The runner is
// somebody else, and reads it from the shared directory.
function readable(): void {
  spawnSync("docker", [
    "exec",
    "-u",
    "agent",
    CLIENT,
    "sh",
    "-c",
    "chmod -R g+rX /output/debug 2>/dev/null || true",
  ]);
}

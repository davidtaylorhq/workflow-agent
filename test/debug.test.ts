import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { failures } from "../lib/debug.ts";

// The shapes below are what term-llm writes: an entry carries `type`,
// `event_type` and `data` (internal/llm/debug_logger.go:121-125), and a
// finished tool call fills `tool_call_id`, `tool_name`, `success` and `output`
// (:436-453). Invent these and the parser passes its tests and reads nothing.
const ended = (id: string, name: string, success: boolean, output: string) => ({
  type: "event",
  event_type: "tool_exec_end",
  data: { tool_call_id: id, tool_name: name, success, output },
});

const failed = (error: string) => ({
  type: "event",
  event_type: "error",
  data: { error },
});

function record(
  t: { after: (fn: () => void) => void },
  files: Record<string, unknown[]>
) {
  const dir = mkdtempSync(join(tmpdir(), "debug-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const logs = join(dir, "debug");
  mkdirSync(logs);
  for (const [name, lines] of Object.entries(files)) {
    writeFileSync(
      join(logs, name),
      lines.map((l) => JSON.stringify(l)).join("\n") + "\n"
    );
  }
  return logs;
}

test("a failed tool says why, and a successful one says nothing", async (t) => {
  const dir = record(t, {
    "a.jsonl": [
      { type: "session_start" },
      ended("1", "workspace__shell", true, "ok"),
      ended("2", "spawn_agent", false, "review-history: timed out after 150s"),
    ],
  });

  assert.deepEqual(await failures(dir), [
    "spawn_agent failed: review-history: timed out after 150s",
  ]);
});

// The out-of-time pass is a second term-llm, which opens a record of its own
// and replays the history it resumed.
test("every record is read, and a replayed failure is reported once", async (t) => {
  const dir = record(t, {
    "1-first.jsonl": [ended("2", "spawn_agent", false, "no history to read")],
    "2-retry.jsonl": [
      ended("2", "spawn_agent", false, "no history to read"),
      ended("9", "workspace__grep", false, "bad pattern"),
    ],
  });

  assert.deepEqual(await failures(dir), [
    "spawn_agent failed: no history to read",
    "workspace__grep failed: bad pattern",
  ]);
});

test("an error the run reported is kept too", async (t) => {
  const dir = record(t, { "a.jsonl": [failed("context deadline exceeded")] });
  assert.deepEqual(await failures(dir), [
    "the run reported: context deadline exceeded",
  ]);
});

test("a run with nothing wrong says nothing", async (t) => {
  const dir = record(t, { "a.jsonl": [ended("1", "line_comment", true, "")] });
  assert.deepEqual(await failures(dir), []);
});

// Every one of these threw out of the first version of this module.
test("a record it cannot make sense of does not throw", async (t) => {
  const dir = record(t, {
    "a.jsonl": [
      null,
      "a bare string",
      42,
      { type: "event" },
      { type: "event", event_type: "tool_exec_end" },
      { type: "event", event_type: "tool_exec_end", data: null },
      { type: "event", event_type: "tool_exec_end", data: { success: false } },
      { type: "event", event_type: "error", data: {} },
      ended("7", "glob", false, "the one real failure"),
    ],
  });

  const said = await failures(dir);
  assert.ok(
    said.includes("glob failed: the one real failure"),
    "the real failure survives its neighbours"
  );
  assert.ok(said.includes("a tool failed: no output was recorded"));
  assert.ok(said.includes("the run reported: an error with no message"));
});

test("an unreadable line does not hide the rest", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "debug-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const logs = join(dir, "debug");
  mkdirSync(logs);
  writeFileSync(
    join(logs, "a.jsonl"),
    "not json\n" + JSON.stringify(ended("9", "grep", false, "boom")) + "\n"
  );
  assert.deepEqual(await failures(logs), ["grep failed: boom"]);
});

test("no record at all is not an error", async () => {
  assert.deepEqual(await failures(join(tmpdir(), "nothing-here-at-all")), []);
});

// The same mount the sandbox can write to, and the same hardening lib/output.ts
// applies to it.
test("a special file is skipped rather than waited on", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "debug-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const logs = join(dir, "debug");
  mkdirSync(logs);
  execFileSync("mkfifo", [join(logs, "pipe.jsonl")]);
  writeFileSync(
    join(dir, "elsewhere"),
    JSON.stringify(failed("leaked")) + "\n"
  );
  symlinkSync(join(dir, "elsewhere"), join(logs, "link.jsonl"));

  assert.deepEqual(await failures(logs), [], "neither is followed or read");
});

test("a record it cannot open is reported, not thrown", async (t) => {
  if (process.getuid?.() === 0) {
    return; // Mode 0000 does not stop root.
  }
  const dir = mkdtempSync(join(tmpdir(), "debug-"));
  t.after(() => {
    chmodSync(join(dir, "debug"), 0o700);
    rmSync(dir, { recursive: true, force: true });
  });
  const logs = join(dir, "debug");
  mkdirSync(logs);
  writeFileSync(join(logs, "a.jsonl"), "{}\n");
  chmodSync(logs, 0o000);

  const said: string[] = [];
  const was = console.error;
  console.error = (...args: unknown[]) => said.push(args.join(" "));
  try {
    assert.deepEqual(await failures(logs), []);
  } finally {
    console.error = was;
  }
});

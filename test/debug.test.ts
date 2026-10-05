import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { failures } from "../lib/debug.ts";

function record(t: { after: (fn: () => void) => void }, lines: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), "debug-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const logs = join(dir, "debug");
  mkdirSync(logs);
  writeFileSync(
    join(logs, "session.jsonl"),
    lines.map((l) => JSON.stringify(l)).join("\n") + "\n"
  );
  return logs;
}

const result = (
  id: string,
  name: string,
  content: string,
  is_error?: boolean
) => ({
  type: "turn_request",
  request: {
    messages: [{ parts: [{ tool_result: { id, name, content, is_error } }] }],
  },
});

// A failed spawn shows in the run's own output as a coloured dot. The reason
// is only ever in this record.
test("a failed tool says why", (t) => {
  const dir = record(t, [
    { type: "session_start" },
    result("1", "workspace__shell", "ok", false),
    result("2", "spawn_agent", "timed out after 150s", true),
  ]);

  assert.deepEqual(failures(dir), ["spawn_agent failed: timed out after 150s"]);
});

test("the same failure is reported once, however often it is replayed", (t) => {
  const dir = record(t, [
    result("2", "spawn_agent", "no history to read", true),
    result("2", "spawn_agent", "no history to read", true),
  ]);
  assert.equal(failures(dir).length, 1);
});

test("a run with nothing wrong says nothing", (t) => {
  const dir = record(t, [result("1", "line_comment", "Noted.", false)]);
  assert.deepEqual(failures(dir), []);
});

test("no record at all is not an error", () => {
  assert.deepEqual(failures(join(tmpdir(), "nothing-here-at-all")), []);
});

test("an unreadable line does not hide the rest", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "debug-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const logs = join(dir, "debug");
  mkdirSync(logs);
  writeFileSync(
    join(logs, "session.jsonl"),
    "not json\n" + JSON.stringify(result("9", "grep", "boom", true)) + "\n"
  );
  assert.deepEqual(failures(logs), ["grep failed: boom"]);
});

// Diagnostics must never be the reason a run fails.
test("a record it cannot read is reported, not thrown", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "debug-"));
  t.after(() => {
    chmodSync(join(dir, "debug"), 0o700);
    rmSync(dir, { recursive: true, force: true });
  });
  const logs = join(dir, "debug");
  mkdirSync(logs);
  writeFileSync(join(logs, "session.jsonl"), "{}\n");
  chmodSync(logs, 0o000);

  const said: string[] = [];
  const was = console.error;
  console.error = (...args: unknown[]) => said.push(args.join(" "));
  try {
    assert.deepEqual(failures(logs), []);
  } finally {
    console.error = was;
  }
  assert.match(said.join("\n"), /could not read the run's record/);
});

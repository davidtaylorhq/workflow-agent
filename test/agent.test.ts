import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { seconds } from "../lib/agent.ts";

test("term-llm's durations are read the way it writes them", () => {
  assert.equal(seconds("10m"), 600);
  assert.equal(seconds("90s"), 90);
  assert.equal(seconds("1h30m"), 5400);
  assert.equal(seconds(""), 0, "an unset budget is no deadline at all");
});

function noted(deadline?: string) {
  const dir = mkdtempSync(join(tmpdir(), "finding-"));
  try {
    const run = spawnSync(
      join(import.meta.dirname, "..", "agent/scripts/line-comment.sh"),
      {
        input: '{"path":"a.ts","line":1,"body":"wrong"}',
        encoding: "utf8",
        env: { ...process.env, OUTPUT_DIR: dir, DEADLINE: deadline ?? "" },
      }
    );
    assert.equal(run.status, 0, run.stderr);
    return run.stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const now = () => Math.floor(Date.now() / 1000);

// Posting a finding is the one thing the agent does throughout a review, so
// it is where it can be told how long it has left.
test("leaving a finding says how much of the turn is left", () => {
  assert.match(noted(String(now() + 300)), /About 5 minutes left/);
  assert.match(noted(String(now() + 30)), /About 3\d seconds left/);
  assert.match(noted(String(now() - 5)), /out of time\. Call finish now/);
});

test("with no deadline it just says the finding is held", () => {
  const said = noted();
  assert.match(said, /posted as part of the review/);
  assert.doesNotMatch(said, /left in this turn|out of time/);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { unsent } from "../lib/github.ts";

const failure = (cause?: { code?: string; syscall?: string }) =>
  Object.assign(new TypeError("fetch failed"), { cause });

// Sending a request twice posts a comment twice, so only a failure that
// proves GitHub never saw a whole request may be sent again.
test("a request that never reached GitHub may be sent again", () => {
  for (const code of ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"]) {
    assert.equal(unsent(failure({ code })), true, code);
  }
  assert.equal(
    unsent(failure({ code: "EPIPE", syscall: "write" })),
    true,
    "cut off mid-body, so nothing complete arrived"
  );
});

test("a request that may have been acted on is left alone", () => {
  assert.equal(
    unsent(failure({ code: "EPIPE", syscall: "read" })),
    false,
    "the answer was lost, not the request"
  );
  assert.equal(
    unsent(failure({ code: "ECONNRESET" })),
    false,
    "without a syscall there is no telling when it broke"
  );
  assert.equal(unsent(failure({ code: "ETIMEDOUT", syscall: "write" })), false);
  assert.equal(unsent(failure()), false);
  assert.equal(unsent(new Error("something else")), false);
});

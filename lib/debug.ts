// What went wrong inside a turn, from the record term-llm keeps of it.
//
// The run's own output gives a mark per tool call and no reason, so a failed
// tool or spawned agent says nothing. term-llm logs one event as each call
// finishes, which is the only account that covers the turn it died on.
import {
  closeSync,
  constants,
  createReadStream,
  fstatSync,
  openSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

type Event = {
  type?: unknown;
  event_type?: unknown;
  data?: {
    tool_call_id?: unknown;
    tool_name?: unknown;
    success?: unknown;
    output?: unknown;
    error?: unknown;
  };
};

function logs(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".jsonl"))
      .sort()
      .map((name) => join(dir, name));
  } catch {
    return [];
  }
}

// A turn that runs out of time is answered by a second term-llm, which opens a
// record of its own, so every file the run left behind is part of the account.
async function* lines(path: string): AsyncGenerator<string> {
  // The container can create links and special files in its writable mount.
  const fd = openSync(
    path,
    // eslint-disable-next-line no-bitwise -- combine open flags
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  );
  try {
    if (!fstatSync(fd).isFile()) {
      return;
    }
    // A record holds every turn's whole history, so it is far too large to read
    // whole by the time it has anything interesting to say.
    yield* createInterface({
      input: createReadStream("", { fd, autoClose: false }),
      crlfDelay: Infinity,
    });
  } finally {
    closeSync(fd);
  }
}

const text = (value: unknown, fallback: string) =>
  typeof value === "string" && value !== "" ? value : fallback;

export async function failures(
  dir = join(process.env.RUNNER_TEMP ?? "", "output", "debug")
): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const path of logs(dir)) {
    try {
      for await (const line of lines(path)) {
        let event: Event;
        try {
          event = JSON.parse(line) as Event;
        } catch {
          continue;
        }
        if (
          event === null ||
          typeof event !== "object" ||
          event.type !== "event"
        ) {
          continue;
        }
        const data = event.data;
        if (typeof data !== "object" || data === null) {
          continue;
        }

        if (event.event_type === "error") {
          out.push(
            `the run reported: ${text(data.error, "an error with no message")}`
          );
          continue;
        }
        if (event.event_type !== "tool_exec_end" || data.success !== false) {
          continue;
        }
        // One failure is logged once per record, and a retry replays the record
        // it resumed, so the same call can arrive more than once.
        const id = text(data.tool_call_id, "");
        if (id !== "" && seen.has(id)) {
          continue;
        }
        seen.add(id);
        out.push(
          `${text(data.tool_name, "a tool")} failed: ${text(data.output, "no output was recorded")}`
        );
      }
    } catch (error) {
      // Saying nothing is worse than a run that dies telling us why it cannot.
      console.error(`could not read ${path}: ${error}`);
    }
  }
  return out;
}

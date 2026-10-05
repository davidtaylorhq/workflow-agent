// What went wrong inside a turn, from the record term-llm keeps of it.
//
// The run's own output gives a status per tool call and nothing else, so a
// failed tool or spawned agent shows as a mark with no reason. Every turn's
// request carries the results it is answering, and a failed one says why.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const LIMIT = 2000;

type Part = {
  tool_result?: {
    id: string;
    name: string;
    content: string;
    is_error?: boolean;
  };
};
type Entry = {
  type: string;
  message?: string;
  request?: { messages?: { parts?: Part[] }[] };
};

function newest(dir: string): string | undefined {
  if (!existsSync(dir)) {
    return undefined;
  }
  const logs = readdirSync(dir)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => join(dir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return logs[0];
}

export function failures(
  dir = join(process.env.RUNNER_TEMP ?? "", "output", "debug")
): string[] {
  const log = newest(dir);
  if (log === undefined) {
    return [];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of readFileSync(log, "utf8").split("\n")) {
    if (!line.trim()) {
      continue;
    }
    let entry: Entry;
    try {
      entry = JSON.parse(line) as Entry;
    } catch {
      continue;
    }
    if (entry.type === "diagnostic" && entry.message) {
      out.push(entry.message);
      continue;
    }
    for (const message of entry.request?.messages ?? []) {
      for (const part of message.parts ?? []) {
        const result = part.tool_result;
        if (!result?.is_error || seen.has(result.id)) {
          continue;
        }
        seen.add(result.id);
        const said = result.content.slice(0, LIMIT);
        out.push(
          `${result.name} failed: ${said}${result.content.length > LIMIT ? " …" : ""}`
        );
      }
    }
  }
  return out;
}

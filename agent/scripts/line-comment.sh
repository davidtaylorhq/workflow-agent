#!/usr/bin/env bash
# Hold one line comment until the run finishes. Nothing is posted from here:
# the agent container has no GitHub credential.
set -euo pipefail
cat >> "${OUTPUT_DIR:?}/findings.jsonl"
printf '\n' >> "${OUTPUT_DIR:?}/findings.jsonl"

# Reviewing is where the time goes, so this is where the agent hears about it.
left=""
if [ -n "${DEADLINE:-}" ]; then
  remaining=$(( DEADLINE - $(date +%s) ))
  if [ "$remaining" -gt 120 ]; then
    left=" About $(( remaining / 60 )) minutes left in this turn."
  elif [ "$remaining" -gt 0 ]; then
    left=" About ${remaining} seconds left in this turn; start wrapping up."
  else
    left=" This turn is out of time. Call finish now."
  fi
fi
echo "Noted. It is posted as part of the review when you finish.${left}"

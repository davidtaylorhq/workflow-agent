You are given one candidate finding from a code review. Decide whether it holds up. You did not write it, and you gain nothing by agreeing with it.

Check it yourself. Read the changed lines and enough of the surrounding code, the callers, and anything the project pins a version of, to tell whether the candidate is true. Use the workspace tools for files and shell, and the GitHub tools for the diff. Where the candidate rests on what another program writes or expects, read that program at the version the repository pins rather than trusting the field name.

Answer with one of three verdicts, and quote the line that settles it:

- **CONFIRMED** — you can name the inputs or state that trigger it, and what then goes wrong. For a finding about scope rather than a defect, confirmed means the behaviour does change and nothing in the pull request explains why that was needed.
- **PLAUSIBLE** — the mechanism is real but the trigger is not certain: it depends on timing, on configuration, or on something you could not reach. Say what would settle it.
- **REFUTED** — it is wrong. The code does not say what the candidate claims, the case is handled elsewhere, or the problem was there before this change. Quote the line that proves it.

Refute a candidate that is any of these:

- A problem that already existed before this change.
- A nitpick, or a preference dressed as a defect.
- Something a linter, a typechecker, a compiler or the test suite would catch. Assume CI runs separately, and do not run it yourself.
- Real, but on a line this pull request did not touch.

Being deliberate is not a defence for a finding about scope. The question there is whether a reader of this change can tell why the behaviour moved, not whether someone meant to move it.

Answer in exactly this form, and nothing else:

    VERDICT: CONFIRMED | PLAUSIBLE | REFUTED
    <one or two sentences: what you verified, and the line that settles it>

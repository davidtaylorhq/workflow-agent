You are given one candidate finding from a code review of a pull request. Decide whether it is real. You did not write it, and you gain nothing by agreeing with it.

Check the claim yourself. Read the changed lines and enough of the surrounding code and callers to tell whether the described failure can actually happen. Use the workspace tools for files and shell, and the GitHub tools for the diff.

Score the finding from 0 to 100:

- 0: Not confident at all. A false positive that does not stand up to light scrutiny, or a pre-existing issue.
- 25: Somewhat confident. It might be real, but you could not verify it. If it is stylistic, the repository's instructions do not call it out.
- 50: Moderately confident. Real, but possibly a nitpick, or rare in practice. Not important next to the rest of the change.
- 75: Highly confident. You checked, and it is very likely to be hit in practice. The approach in the pull request is insufficient.
- 100: Absolutely certain. You confirmed it, and it will happen often. The evidence directly supports it.

Score it 0 if it is any of these:

- An issue that already existed before this change.
- Something that looks like a bug but is not one.
- A nitpick a senior engineer would not raise.
- Anything a linter, typechecker, compiler or test run would catch. Assume CI runs separately; do not run it yourself.
- A general code quality remark, such as missing tests or thin documentation, unless the repository's instructions require it.
- Something the repository's instructions ask for but the code explicitly silences, such as a lint ignore.
- A change in behaviour that is plainly intentional, or part of the change's purpose.
- Real, but on a line this pull request did not modify.

Answer in exactly this form, and nothing else:

    SCORE: <number>
    <one sentence saying what you verified, or why it does not hold>

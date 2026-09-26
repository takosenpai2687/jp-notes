---
name: commit
description: Create a git commit with an English Conventional-Commits subject and description, both stamped with the current formatted date, crediting the model currently in use as co-author.
whenToUse: The user asks to commit, save, or check in work to git, or invokes /commit.
---

# Commit

Produce exactly one git commit in the current repository, in the house format below. Never push unless the user asks.

## The format (fixed)

Three paragraphs separated by blank lines:

    <type>(<scope>): <imperative subject in English> [<DATE>]

    <Description in English: what changed and why, wrapped at ~72 columns>

    Date: <DATE>

    Co-authored-by: <MODEL> <noreply@deepseek.com>

The trailer paragraph comes last, and `Co-authored-by` must keep exactly that capitalization or GitHub will not recognise it.

Assembled example:

    feat(notes): add N3 grammar index [2026-09-27]

    Add an index page collecting the N3 grammar points and link it from the
    study log, which previously scattered them across three files.

    Date: 2026-09-27

    Co-authored-by: deepseek-flash <noreply@deepseek.com>

## The two variables

| Token | Value |
|---|---|
| `<DATE>` | `yyyy-MM-dd`, e.g. `2026-09-27`. Read the clock — never guess it. |
| `<MODEL>` | The model you are currently running as. |

- Date, Windows/pwsh: `Get-Date -Format "yyyy-MM-dd"`
- Date, POSIX: `date +%F`
- Model: your own system prompt names it verbatim in the phrase "powered by the `<model>` model" — use that exact string (for example `deepseek-flash`). Only when your system prompt names no model, fall back to `agent-default-model.model` in `$DSH_HOME/settings.yaml` (default `~/.dsh/settings.yaml`). Never invent a model name.
- `<type>` is one of `feat fix docs style refactor perf test build ci chore revert`; `<scope>` is a short lowercase area name, and its parentheses are dropped when no single area fits.

## Procedure

1. **Inspect.** Confirm the repository (`git rev-parse --is-inside-work-tree`), read `git status --short --branch`, `git diff`, and `git diff --staged`, then `git log --oneline -10` to match the repository's existing tone.
2. **Resolve** `<DATE>` and `<MODEL>` as above.
3. **Stage deliberately.** Prefer explicit paths (`git add <path>...`); use `git add -A` only when the user asked for the whole tree. Never stage credentials, `.env` files, or unrelated scratch, and if `git status` shows anything you cannot explain, ask before committing.
4. **Commit** with one `-m` per paragraph, so the blank lines come out right and no temporary file is needed:
   ```powershell
   git commit -m "feat(notes): add N3 grammar index [2026-09-27]" -m "Add an index page collecting the N3 grammar points and link it from the study log." -m "Date: 2026-09-27" -m "Co-authored-by: deepseek-flash <noreply@deepseek.com>"
   ```
   Add no other trailer: no `Signed-off-by`, no `Generated with ...`, nothing the user did not ask for. Never pass `--no-verify`; if a hook fails, fix the cause.
5. **Verify** with `git log -1 --format=full`: the subject, both date occurrences, and the `Co-authored-by:` line must all be present.
6. **Report** the short SHA, the subject line, and how many files changed.

## Edge cases

- Clean working tree: say so and stop. Do not create an empty commit.
- The user asks to split the work: make one commit per logical change, each with its own date and trailer.
- Everything written into the commit is English — subject, description, type, and scope.

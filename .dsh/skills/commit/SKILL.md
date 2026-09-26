---
name: commit
description: Create a git commit with an English Conventional-Commits subject and description, both stamped with the current formatted date, crediting the model currently in use as co-author.
whenToUse: The user asks to commit, save, or check in work to git, or invokes /commit.
---

# Commit

One commit per request. Never push unless asked.

## Format

```
<type>(<scope>): <imperative subject in English> [<DATE>]

<English description - what changed and why, wrapped at ~72 columns>

Date: <DATE>

Co-authored-by: <MODEL> <noreply@deepseek.com>
```

```
feat(notes): add N3 grammar index [2026-09-27]

Add an index page collecting the N3 grammar points and link it from the
study log, which previously scattered them across three files.

Date: 2026-09-27

Co-authored-by: deepseek-flash <noreply@deepseek.com>
```

`Co-authored-by` keeps exactly that capitalization. Add no other trailer.

## Values

- `<DATE>` — `yyyy-MM-dd` read from the clock, never guessed.
- `<MODEL>` — the model named in your own system prompt ("powered by the `<model>` model", e.g. `deepseek-flash`). Fallback only when unnamed: `agent-default-model.model` in `$DSH_HOME/settings.yaml` (`~/.dsh/settings.yaml`).
- `<type>` — `feat fix docs style refactor perf test build ci chore revert`. `<scope>` — short lowercase; drop the parentheses when none fits.

## Run

```powershell
# 1. inspect
git rev-parse --is-inside-work-tree
git status --short --branch
git diff
git diff --staged
git log --oneline -10

# 2. date
Get-Date -Format "yyyy-MM-dd"

# 3. stage explicit paths - use `git add -A` only when the user asked for the whole tree
git add <path>...

# 4. commit - one -m per paragraph, so the blank lines come out right
git commit -m "<type>(<scope>): <subject> [<DATE>]" -m "<description>" -m "Date: <DATE>" -m "Co-authored-by: <MODEL> <noreply@deepseek.com>"

# 5. verify
git log -1 --format=full
```

Step 4 filled in:

```powershell
git commit -m "feat(notes): add N3 grammar index [2026-09-27]" -m "Add an index page collecting the N3 grammar points and link it from the study log." -m "Date: 2026-09-27" -m "Co-authored-by: deepseek-flash <noreply@deepseek.com>"
```

Never `--no-verify`; if a hook fails, fix the cause. Never stage credentials, `.env` files, or unrelated scratch — ask when `git status` shows something you cannot explain. Report the short SHA, the subject, and the file count.

## Sandbox rules (verified on this machine — do not re-test)

Every other way of reading git's stdout fails; use `cmd /c` plus a file:

```powershell
# broken
git status | Select-String "..."   # Program 'git.exe' failed to run: Access is denied
$x = git rev-list main             # silently empty, no error raised
git log 2>&1                       # same denial

# working
cmd /c "git rev-list --reverse main > .git\rl.txt"
Get-Content .git\rl.txt
```

- `git filter-branch` never works here: it spawns MSYS `sh.exe`, which the sandbox kills. Use the rewrite block below.
- `push`, `fetch`, `pull`, `ls-remote` are denied under workspace-write (`cannot create standard input pipe for remote-https`). They need a one-shot `danger-full-access` escalation — request it on the real command, not on a throwaway probe.

```powershell
$env:GIT_TERMINAL_PROMPT='0'; git push --force-with-lease origin main
```

## Rewrite existing commits (identity / message)

Needs no shell. Preserves the tree, the message, and both timestamps; only the author and committer change. Set the three variables and run the block as one piece:

```powershell
$name = '<Name>'; $email = '<email>'; $branch = 'main'
cd <repo>
git branch backup-pre-rewrite
cmd /c "git log --reverse --format=%H#%T#%aI#%cI $branch > .git\meta.txt"
$newParent = $null
foreach ($line in (Get-Content .git\meta.txt)) {
  $line = $line.Trim(); if (-not $line) { continue }
  $p = $line -split '#'
  $sha=$p[0]; $tree=$p[1]; $ad=$p[2]; $cd=$p[3]
  cmd /c "git show -s --format=%B $sha > .git\msg.txt"
  $env:GIT_AUTHOR_NAME=$name;    $env:GIT_AUTHOR_EMAIL=$email;    $env:GIT_AUTHOR_DATE=$ad
  $env:GIT_COMMITTER_NAME=$name; $env:GIT_COMMITTER_EMAIL=$email; $env:GIT_COMMITTER_DATE=$cd
  if ($newParent) { cmd /c "git commit-tree $tree -p $newParent -F .git\msg.txt > .git\new.txt" }
  else            { cmd /c "git commit-tree $tree -F .git\msg.txt > .git\new.txt" }
  $newParent = (Get-Content .git\new.txt -Raw).Trim()
}
git update-ref "refs/heads/$branch" $newParent
Remove-Item .git\meta.txt,.git\msg.txt,.git\new.txt -Force
```

`--reverse` is oldest-first, so each new commit's parent is the previous iteration's result. `#` delimits the fields because `|`, `;`, and `,` are all special to `cmd`.

All three checks must hold before pushing:

```powershell
git log --format="%h | A: %an <%ae> | C: %cn <%ce>"
git log --format="%h %T"           # tree SHAs unchanged
git log --format="%h A=%aI C=%cI"  # timestamps unchanged
$env:GIT_TERMINAL_PROMPT='0'; git push --force-with-lease origin main
git branch -D backup-pre-rewrite
```

The replaced SHAs vanish from the remote, so other clones and forks must re-fetch — say so when reporting.

## Edge cases

- Clean working tree: say so and stop. Do not create an empty commit.
- Split requested: one commit per logical change, each with its own date and trailer.
- Everything in the commit is English — subject, description, type, and scope.

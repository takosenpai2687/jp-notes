# DSH agent assets

This project keeps its DeepSeek Harness assets under `.dsh/`. Everything in
`.dsh/skills/` is discovered automatically by `dsh web` while the working
directory is inside this project — no config edit and no restart needed, because
the root is watched.

## Layout

    .dsh/
    ├── SKILLS.md              this guide
    └── skills/                the DSH skill root for this project
        └── commit/
            ├── SKILL.md       required
            ├── references/    optional, loaded on demand
            ├── scripts/       optional
            └── assets/        optional

Each skill is one directory bundle holding a `SKILL.md`, directly under
`.dsh/skills/`. A flat `.dsh/skills/<skill-name>.md` file works too.

**Keep bundles at the top level.** Discovery is exactly one level deep, so
`.dsh/skills/git/commit/SKILL.md` is silently *not* discovered. Group with
naming, not with folders.

## `SKILL.md` frontmatter

```yaml
---
name: kebab-case-name            # required, kebab-case
description: One sentence.       # required, shown in the model's skill catalog
whenToUse: When to reach for it. # optional
# disable-model-invocation: true # keep it out of the model catalog
# user-invocable: false          # hide it from /commands
---
```

The body is free-form Markdown and is re-read on every load, so editing it needs
no restart. A file without valid frontmatter is skipped with a warning.

## Where DSH looks, in priority order

| Rank | Source | Path |
|---|---|---|
| 100 | project | `<project>/.dsh/skills` ← this directory (project = nearest ancestor with `.git`) |
| 200 | project | `<project>/.agents/skills` |
| 300 | custom | `customSkillDirs` in the plugin config |
| 400 | user | `~/.dsh/skills` |
| 500 | user | `~/.agents/skills` |

Lower rank wins on a name collision, so these project skills shadow same-named
user skills. To make a skill available in *every* project, put it in
`~/.dsh/skills/` instead — a copy or a symlink of the same bundle works.

## Agent instructions (the "agents" half)

DSH also loads plain-Markdown agent instructions, with no frontmatter at all:

- `<project>/AGENTS.md` (or `CLAUDE.md`) — project rules, plus `AGENTS.local.md`
  / `CLAUDE.local.md` overlays, read from the project root down to the cwd.
- `~/.dsh/AGENTS.md` — your user-global rules.

The split: `AGENTS.md` carries standing instructions the agent should *always*
obey; `.dsh/skills/` carries task-shaped capabilities it loads only when a
request matches. If you want it always on, it belongs in `AGENTS.md`.

## Using a skill

- Model-initiated: the agent sees the catalog and calls the `skill` tool with the
  exact name.
- Human-initiated: type `/<skill-name>` in the session, e.g. `/commit`.

## Skills in this project

| Skill | Purpose |
|---|---|
| `commit` | Write a dated English commit with the current model credited as co-author. |

---
name: conventional-commits
description: >-
  Write a git commit message that follows the Conventional Commits standard,
  with a subject line of at most 50 characters and a concise body when the
  change needs explaining, then create the commit. Use this skill whenever the
  user wants to commit staged changes, asks you to "write a commit message",
  "commit this", "make a commit", or otherwise needs a well-formed git commit —
  even if they don't say the words "conventional commit". Reach for it before
  running a bare `git commit` so the message stays consistent and within limits.
---

# Conventional Commits

Compose a commit message that conforms to the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
specification, keep the subject line within 50 characters, add a short body only
when the change genuinely needs explaining, then create the commit.

## Why the rules are what they are

- **Conventional Commits** give the history a machine- and human-readable shape:
  the `type` tells you at a glance whether a commit is a feature, a fix, or
  noise, and tools can derive changelogs and semantic-version bumps from it.
- **50-character subject** keeps `git log --oneline`, GitHub's commit list, and
  `git shortlog` readable without truncation. The subject is a *headline*, not a
  description — if it doesn't fit in 50 characters, the change is usually better
  summarized at a higher level, with the detail moved to the body.
- **A body only when needed** respects the reader. A one-line dependency bump
  needs no body; a non-obvious bug fix needs the *why*. Don't pad.

## Workflow

1. **See what's being committed.** Run `git status --short` and
   `git diff --cached` to read the staged changes. Also glance at
   `git diff` for unstaged work.
   - If **nothing is staged** but there are changes, don't silently stage
     everything. Tell the user what's modified and ask whether to stage all of
     it or specific files (or let them stage first). Stage with `git add` only
     after that's clear.
   - If the staged changes span **several unrelated concerns**, say so and
     suggest splitting them into separate commits — one logical change per
     commit is what makes the type/subject honest.

2. **Match the repo's conventions.** Skim `git log --oneline -20`. Reuse the
   scopes and phrasing the project already uses, and preserve any trailers the
   repo relies on (e.g. `Co-Authored-By:`, `Signed-off-by:`, issue refs like
   `Refs #123`). Consistency with the existing history beats personal style.

3. **Compose the message** following the format below.

4. **Confirm before committing.** Show the user the full proposed message and
   wait for a yes (or edits). This is the moment to catch a wrong type or a
   subject that misses the point — cheap now, annoying after the commit exists.

5. **Commit.** Use a `git commit` invocation that preserves formatting. The
   reliable way is one `-m` for the subject and one `-m` per body paragraph:
   ```bash
   git commit -m "feat(auth): add JWT login" -m "Body paragraph explaining why."
   ```
   Don't push unless the user asks.

## Message format

```
<type>(<optional scope>): <subject>
<BLANK LINE>
<optional body>
<BLANK LINE>
<optional footer(s)>
```

### Subject line (required, ≤ 50 characters total)

The 50 characters include the `type`, the scope, the colon, and the space — the
*entire* first line. Compose, then count; if it's over, tighten.

- **type**: one of the standard set:
  - `feat` — a new feature (user-facing capability)
  - `fix` — a bug fix
  - `docs` — documentation only
  - `style` — formatting/whitespace, no code-behavior change
  - `refactor` — code change that neither fixes a bug nor adds a feature
  - `perf` — a performance improvement
  - `test` — adding or correcting tests
  - `build` — build system or dependencies
  - `ci` — CI configuration and scripts
  - `chore` — maintenance that doesn't fit above (e.g. tooling, housekeeping)
  - `revert` — reverts a previous commit
- **scope** *(optional)*: a noun naming the area touched, e.g. `feat(parser):`.
  It's the first thing to drop when you're fighting the 50-char limit — it's
  optional precisely so the subject can breathe.
- **subject**: imperative mood ("add", not "added"/"adds"), lowercase first
  letter, **no trailing period**. Imperative reads as "this commit will _add x_",
  matching git's own generated messages ("Merge branch…").

If you can't make a meaningful subject fit in 50 characters, that's usually a
signal the commit is doing too much — prefer splitting it over cramming.

### Body (include only when it adds value)

Separate from the subject with one blank line. **Hard-wrap every body line at 72
characters** — insert real newlines, don't rely on the editor to soft-wrap. Git
doesn't reflow commit bodies, so an unwrapped paragraph shows up as one runaway
line in `git log` and gets truncated in many tools. This applies even to a
single-sentence body: if it runs past 72 characters, break it across lines.

Explain **what changed and especially why** — the motivation, the tradeoff, the
context a reviewer won't get from the diff. Don't restate the diff line by line.

Skip the body entirely for self-explanatory changes (typo fixes, version bumps,
renames). A good rule: if the subject already tells the whole story, stop there.

### Breaking changes

Signal an incompatible change either with a `!` before the colon
(`feat(api)!: drop v1 endpoints`) or a footer `BREAKING CHANGE: <description>`,
or both. The footer goes in the footer section after a blank line.

### Footers

Optional trailers in `Token: value` form, after a blank line below the body —
e.g. `Refs #42`, `Reviewed-by: …`, or `BREAKING CHANGE: …`. Preserve any the
repo already uses.

## Examples

**Example 1 — small fix, no body needed**
Staged: corrected an off-by-one in pagination.
```
fix(pagination): include the last page
```

**Example 2 — feature with a body explaining why**
Staged: added retry-with-backoff around the upload client.
```
feat(upload): retry failed uploads

Network blips were surfacing as hard failures to users. Retry up to
three times with exponential backoff before giving up, which covers
the transient errors seen in production logs.
```

**Example 3 — subject trimmed to fit 50 chars**
Long idea: "add configuration option to control the request timeout". Naming it
all blows the limit, so summarize in the subject and detail in the body:
```
feat(http): make request timeout configurable

Adds a `timeoutMs` option (default 30s) so callers behind slow proxies
can raise it without patching the client.
```

**Example 4 — breaking change**
```
refactor(api)!: remove deprecated v1 routes

BREAKING CHANGE: the /v1/* endpoints are gone; clients must move to
/v2. See MIGRATION.md for the mapping.
```

## Quick checklist before committing

- Subject ≤ 50 characters (count the whole line).
- Valid `type`; scope optional and lowercase.
- Imperative mood, lowercase start, no trailing period.
- Body present only if it explains something the diff doesn't; every line
  hard-wrapped at 72 characters (including a one-line body).
- Repo's existing trailers/conventions preserved.
- User has confirmed the wording.

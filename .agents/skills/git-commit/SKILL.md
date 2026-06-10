---
name: git-commit
description: Guidelines for staging changes and committing them with clean, concise, and conventional commit messages.
---

# Skill: Git Stage & Commit Automation

This skill defines the instructions and best practices for staging changes in the workspace and committing them with a clear, concise commit message.

## Stage & Commit Workflow

When the user asks you to commit changes, follow this systematic workflow:

1. **Stage and commit changes**:
   - If there are only modified/deleted files (no new untracked files), use the combined built-in command:
     `git commit -am "<message>"`
   - If there are new untracked files, stage everything and commit:
     `git add -A && git commit -m "<message>"`

2. **Generate a descriptive commit message**:
   - Adhere to the **Conventional Commits** spec:
     - `feat: ...` for new features (e.g., `feat: add mobile touch controls`)
     - `fix: ...` for bug fixes (e.g., `fix: resolve joystick overlap with action bar`)
     - `refactor: ...` for code cleanup or structure updates
     - `docs: ...` for documentation modifications
     - `style: ...` for layout, styling, or formatting tweaks
   - Keep the subject line concise (under 60 characters) and written in the imperative mood (e.g., "add controls" instead of "added controls").

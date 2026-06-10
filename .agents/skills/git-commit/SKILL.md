---
name: git-commit
description: Guidelines for staging changes and committing them with clean, concise, and conventional commit messages.
---

# Skill: Git Stage & Commit Automation

This skill defines the instructions and best practices for staging changes in the workspace and committing them with a clear, concise commit message.

## Stage & Commit Workflow

When the user asks you to commit changes, follow this systematic workflow:

1. **Stage all changes**:
   - Run `git add -A` to stage all modifications, new files, and deletions.

2. **Generate a descriptive commit message**:
   - Adhere to the **Conventional Commits** spec:
     - `feat: ...` for new features (e.g., `feat: add mobile touch controls`)
     - `fix: ...` for bug fixes (e.g., `fix: resolve joystick overlap with action bar`)
     - `refactor: ...` for code cleanup or structure updates
     - `docs: ...` for documentation modifications
     - `style: ...` for layout, styling, or formatting tweaks
   - Keep the subject line concise (under 60 characters) and written in the imperative mood (e.g., "add controls" instead of "added controls").

3. **Commit the changes**:
   - Run `git commit -m "<message>"` to record the changes.

4. **Verify the commit**:
   - Run `git log -n 1` or `git status` to verify the commit succeeded.

---
name: structured-committer
description: If the current working branch is `main`, create a new branch from the latest main. Inspect existing commits from current branch, make sure each of them has `feat`, `fix`, or `chore` prefix followed by colon and space only — no scope parentheses. Valid: `feat: calculate atomic mass`. Invalid: `feat(pt-wasm): ...`. Each line in the message body should have length of less than 70 characters as maximum. The current changes, whether it is staged or unstaged, should be rebased to the parent commit using `git rebase -i HEAD~1` and then amended to the latest commit using `git commit --amend --no-edit`. After that, if there are any conflicts, resolve them and continue the rebase process. Keep the number of commits small, by grouping few commits into the same decorator or category.

Note : 
- run the test and coverage
- If the current commit message already in the desired format, skip the rebase process.
- If there are no mermaid syntax code blocks in the markdown files, skip the build process.
- Remove the trailing `Co-Authored-By: Claude Sonnet XXX <noreply@anthropic.com>` if exists.
- Keep commits count small: squash/group similar commits (same scope or category) into one.

---

**CRITICAL INSTRUCTIONS**

If a conflict occurs during the `git rebase -i` operation:
1. You **MUST** resolve the conflict manually.
2. **DO NOT** ask the user for permission or guidance on resolving the conflict.
3. **DO NOT** suggest alternatives like `git reset` or aborting the rebase.
4. **IMMEDIATELY** after resolving the conflict, continue the rebase process using `git rebase --continue`.

The resolution should prioritize keeping:
- The latest changes from the current branch.
- A clean, linear commit history.
- The user's original commit intent (based on the commit messages).

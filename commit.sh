#!/bin/bash
cd "/Users/narissaranamkhan/Documents/Coding Projects/wishcraft"
git add -A
git commit -m "Disable unstable new auth strategy to fix login issues

- Comment out future.unstable_newEmbeddedAuthStrategy
- This feature might be causing the auth error
- Entry.server.tsx already skips auth routes properly

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin master
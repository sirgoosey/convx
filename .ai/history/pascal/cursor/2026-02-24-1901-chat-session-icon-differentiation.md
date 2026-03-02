# Conversation e3ae875e-9aea-4b95-b8bf-9e2178a42797

- Source: `cursor`
- User: `pascal`
- System: `Pascals-MBP.local`
- Started: `2026-02-24T19:01:32.951000Z`
- CWD: `/Users/pascal/Code/business/convx`

## User

wy 2 icons for cursor/claude/codex differentiation? 1 is enough no? remove left hand icon pls.

## Agent

Removing the left-hand source icon from the session list and keeping only the right-hand badge.

## Agent

Summary of changes:

- **Removed** the left-hand icon (`ItemMedia` with Sparkles/Terminal/MousePointerClick) from each session row.
- **Kept** the right-hand pill badge (Claude / Cursor / Codex) as the only source indicator.
- Dropped the `SOURCE_ICON` map and the unused `ItemMedia`, `Sparkles`, `Terminal`, and `MousePointerClick` imports.

Source is now indicated only by the colored badge on the right.

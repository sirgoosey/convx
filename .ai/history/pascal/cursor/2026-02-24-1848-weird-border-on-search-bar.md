# Conversation 61dc9150-5a2d-4f92-a37e-4bb5ef218dfa

- Source: `cursor`
- User: `pascal`
- System: `Pascals-MBP.local`
- Started: `2026-02-24T18:48:17.100000Z`
- CWD: `/Users/pascal/Code/business/convx`

## User

weird border

## Agent

Checking how the focus ring and border interact:

## Agent

Identifying the cause: the InputGroup uses both `border` and a focus `ring` (box-shadow). The ring can render with corner gaps. Using a single focus indicator—a thicker border on focus instead of border + ring—to fix it.

## Agent

Avoiding layout shift: using a 1px border and changing only its color on focus.

## Agent

The search bar’s focus state was using both a **border** and a **ring** (box-shadow). That combo was drawing the focus outline in a way that looked like four segments with gaps at the corners.

The focus style is now only a **border color change** to the ring color: same 1px border, no extra ring. You get a single, continuous outline and no layout shift. Refresh the app and focus the search input to confirm it looks correct.

# LiveVideo Fix Package

This package fixes the first two issues:

1. `/api/youtube/live` now resolves handle-only channels to channel IDs before discovery, and it can still try `@handle/live` even when a channel ID is missing.
2. `components/LiveBlock/LiveBlock.tsx` no longer re-filters the rows more strictly than `/api/live-videos`.

## Replace these files from your project root
- `app/api/youtube/live/route.ts`
- `components/LiveBlock/LiveBlock.tsx`

## Install
Extract this zip into your project root and allow overwrite.

## Recommended smoke test
- Open `/api/youtube/live?handles=YOUR_HANDLE&debug=1`
- Confirm `entriesWithChannelId` is greater than 0 for handle-only rows.
- Confirm the live block now shows rows returned by `/api/live-videos`.

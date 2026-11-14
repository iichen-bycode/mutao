# 我的

- Match the reference order: profile and community, four account counts, activity shortcuts, community/report/settings rows, recent browsing, then three content tabs.
- Read profile counts from the authenticated summary endpoint. Show the member ID and the account-joined community; use a clear fallback when the user has not joined one.
- Provide separate tabs for the user's listings, community posts, and favorites. Load each tab from its existing authenticated API and keep moderation states visible.
- Keep recent browsing as a horizontal strip backed by the device history and link to the full history page.
- Route pending and sold shortcuts to the matching listing filters, messages to conversations, and comments/reports to their own records pages.
- Allow marking a published listing as transferred after confirmation. Keep listing and community-post detail routes distinct.
- Make every async section distinguish loading, retryable failure, and empty states with a relevant next action.
- Use the app's cream and coral tokens, native Mini Program WXML/WXSS/JavaScript, rpx sizing, safe-area spacing, CSS-drawn icons, and reduced-motion support.

# 邻里聊天

- Use a compact, cream-and-coral header with the conversation partner's avatar, name, live availability, a back action, and a phone action only when the seller shared a phone number.
- Keep the related listing visible above the conversation. Show its cover, title, price, and a tap-through to the listing detail.
- For direct conversations without a listing, hide the product card and keep the conversation layout usable.
- Render messages chronologically with incoming and outgoing bubbles, day separators, readable times, and the partner avatar on incoming messages.
- Read partner, listing, and optional public contact details from the authenticated conversation endpoint. The API must verify that the current user belongs to that conversation.
- Mark the conversation read after history loads and while the chat is open so inbox unread counts stay current.
- Show real-time peer presence over WebSocket, alongside the separate message-service connection state and a retry action after disconnects.
- Provide loading, retryable history errors, and a friendly first-message state.
- Keep the composer above the safe area and keyboard; reject blank messages, offer common replies, and preserve the draft if sending fails.
- Deduplicate incoming messages and scroll to the newest message after history loads or a new message arrives.

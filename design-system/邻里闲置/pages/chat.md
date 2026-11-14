# 邻里聊天

- Show a connection state and a retry action when the live connection drops.
- Render messages chronologically, align own messages consistently, and show readable message times.
- Provide loading, retryable history errors, and a friendly first-message state.
- Keep the composer fixed above the safe area and keyboard; reject blank messages and preserve the draft if sending fails.
- Deduplicate incoming messages and scroll to the newest message after history loads or a new message arrives.

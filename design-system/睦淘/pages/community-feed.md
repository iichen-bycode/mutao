# 社区动态

- Keep the feed header focused on community scope. Remove the quick-publish row; show one floating plus action above the tab bar on the community tab and route it to the dedicated community-post composer.
- If the user has not selected a community browsing filter, send no location parameters and return community posts from all communities. Idle listings appear only on the home marketplace.
- A selected community browsing filter applies the configured radius to posts. It does not join the community. Include global announcements when showing a selected community and provide a clear action that returns the scope to all communities.
- Keep the community feed post-only. Load category filters and labels from active community-post category configuration, with an all-posts filter.
- Show announcements, active neighbors, likes, and comment totals from community-post records. Render an empty announcement state when no active announcement exists; do not add sample counts.
- Community posts require account membership in the target community and stay hidden until approved.
- Post cards support real photos, likes, comments, and native sharing. Keep loading and retryable error states. When posts or neighbors are empty, show a simple text line in the same style for each section without an empty card or publish CTA. Respect reduced motion.

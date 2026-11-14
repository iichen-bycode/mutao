# 我的

- Show account identity and joined community, four counts, four activity shortcuts, community/report/settings shortcuts, then tabs for listings and community posts.
- Keep the favorites count as a shortcut to the dedicated favorites list page.
- The activity shortcuts are pending listings, comments, browsing history, and favorites. Route them to their corresponding list pages or listing filter.
- Load account counts from `/users/me/summary`; load the listings and community-post tabs from their authenticated source endpoints.
- Route comments to the member's comments and reports to report history.
- Make the profile edit action update the account nickname through the existing member profile endpoint.
- Show a two-column card grid with image, price or post type, title, neighborhood, and relevant status. Separate listing detail from community-post detail.
- Keep loading, retryable error, and mode-specific empty states. Provide publishing actions for empty listings/posts.

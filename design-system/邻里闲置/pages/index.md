# 逛一逛

- Match the home feed to the compact warm marketplace layout: greeting and title, search input with a same-row location scope label, horizontal category chips, a two-column nearby feed, and a compact recommendation list.
- The location scope starts at “全部” when no location has been chosen. Tapping the scope opens the WeChat location picker; a successful choice updates the label and refreshes the feed while retaining the current search and category filters. Keep the existing location choice across launches.
- Show the current feed scope and make changing it an explicit action.
- Keep search and category filters together above the feed; show the result count and preserve active filters while paging.
- Product cards show an image or neutral placeholder, title, price, community, seller, and a sold status when relevant.
- Open the shared listing detail route so item information and actions match the community feed.
- Distinguish initial loading, paging, empty results, load failure, and end of list. Empty search results offer a clear-filter action; an unfiltered empty feed offers publishing.
- Product cards and filter chips use a stable pressed state and remain easy to tap.
- The home feed and its empty-state publish action are item-only. Query the listings API; community topics, wanted posts, and help requests belong to the community feed.
- The home community selector filters idle listings only. It does not join a community or change the community-post browsing scope.

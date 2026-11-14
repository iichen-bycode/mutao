# 发布内容

- Start with three post types: 闲置转让、邻里话题、寻物/求助. Keep each type visibly selected and save the selected type with the draft.
- Listings require an explicitly selected publishing location, a title, and content; that location is independent of account membership. Community posts require the account-joined community, a title, and content, and the composer links to settings when the user has not joined one.
- Listing posts alone include price, optional original price, active category, condition, and handoff method. Submit them to the listings API so only reviewed listings enter the home item feed.
- Topic and help posts use the community-post API and never appear in the home item feed. Preserve the selected post subtype when opening the publisher from a community quick action.
- Visible labels identify every input. Show inline field errors, character counts, photo count, and the 1–9 image limit; keep successfully uploaded photos if another upload fails.
- Use a numeric keyboard for price and validate a non-negative amount with at most two decimal places. Let users retry category loading.
- Disable repeated submit/upload actions while busy, show per-batch upload progress, and confirm that the listing is pending review after success.
- Autosave the in-progress form and uploaded photo references locally, restore them when the user returns, and offer an explicit save-draft action.
- Remove the local draft only after the server accepts the listing or post; successful submissions enter the pending-review state and open the matching home, community, or personal content view.
- Re-upload restored draft images before submission so expired upload credentials do not make an otherwise valid draft unusable.
- The map opens only from an explicit location action. The UI explains that contact information is public when entered.

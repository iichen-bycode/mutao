# 好物详情

- Use the listing detail route from home and community listing cards. Community topic, wanted, ride, and help posts use the separate community post detail route.
- Present a swipeable photo banner first, with a current/total counter, then price, title, community/category, view and favorite counts, condition, original price, and distance from the explicitly selected community.
- Read prices, counters, and listing status from the API. Show “未填写” for an absent original price and “未选择位置” when there is no selected community coordinate; never invent ratings or distance.
- Support tapping a photo to preview the gallery, isolate individual image load failures, and provide a calm placeholder when there are no photos.
- Show public contact only when the seller opted in; phone contacts call, other contacts copy with confirmation.
- Visitors can favorite, start a conversation, and report. Owners cannot start a conversation with themselves and get owner-specific status/actions instead.
- Keep bottom actions above the safe area and leave enough scroll space beneath them.
- Show loading, retryable load failure, and unavailable states.

# 发布闲置

- Group the form into location, item details, photos, price/category, and contact sections. Mark community, title, description, at least one photo, price, and category as required.
- Visible labels identify every input. Show inline field errors, character counts, photo count, and the 1–9 image limit; keep successfully uploaded photos if another upload fails.
- Use a numeric keyboard for price and validate a non-negative amount with at most two decimal places. Let users retry category loading.
- Disable repeated submit/upload actions while busy, show per-batch upload progress, and confirm that the listing is pending review after success.
- Autosave the in-progress form and uploaded photo references locally, restore them when the user returns, and offer an explicit save-draft action.
- Remove the local draft only after the server accepts the listing; a successful submission enters the existing pending-review state.
- Re-upload restored draft images before submission so expired upload credentials do not make an otherwise valid draft unusable.
- The map opens only from an explicit location action. The UI explains that contact information is public when entered.

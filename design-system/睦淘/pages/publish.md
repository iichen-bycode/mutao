# 发布内容

- Autosave every changed field, selected location, and uploaded photo locally, then restore all unsubmitted listing content when the user returns. Do not show a manual save-draft button in the header.
- The center tab is exclusively for publishing listings. Do not show listing/community post type choices on this page; community posts use the dedicated community composer.
- Present the listing location selector as a clearly tappable card and open the map only after the user taps it. This location is independent of community membership.
- Listings require an active category and up to `config.js`'s `maxListingImages` (default 5) images. Keep the image count, picker limit, and submission validation in sync with that setting. If category loading fails, show the fallback label “闲置” and keep the retry action; submission still requires a valid active category.
- Center the original-price placeholder within a field wide enough to separate it from the currency symbol.
- Remove the community-map privacy helper copy from the selector; retain explicit tap-to-open behavior.
- When an image is removed, remove it from the saved draft immediately, delete its local cached file, and delete the remote object only while it is unclaimed by a published listing or community post.
- Persist pending remote-photo deletions as draft tombstones. Filter those photos during draft restoration and retry cleanup when the publish page is shown so a removed image never reappears after a failed or interrupted request.
- Keep uploaded photos across partial upload failures, preserve the existing upload limit and progress feedback, and disable repeated removal/submission while remote cleanup is running.
- Re-upload restored draft photos before submission when their upload credentials have expired.
- Clear the saved snapshot when all non-default fields are cleared and no explicitly selected location remains, so cleared values do not reappear later.

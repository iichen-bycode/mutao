# 睦淘小程序设计系统

## Product style

- Use the app's Soft Cute UI: warm, calm, neighborly, and easy to scan.
- Build screens with native WeChat Mini Program WXML, WXSS, and JavaScript. Use `rpx` for layout and typography.
- Keep the cream page background `#FFF7F1`, white cards, coral accents `#FF8FA3` / `#FFB5A7`, soft border `#FCD5CE`, primary text `#5A4A48`, and secondary text `#947C7A`.
- Use system Chinese fonts. Avoid emoji as interface icons; draw simple icons with CSS or use bundled vector assets.
- Prefer rounded cards and short, clear labels. Avoid dense text and unnecessary decorative effects.

## Interaction and states

- Every network-backed screen needs loading, retryable error, and useful empty states.
- Keep async requests scoped to authenticated users and derive counts from server data.
- Ask the user to choose a community explicitly before publishing community-specific content. Respect WeChat location privacy authorization.
- Keep fixed bottom controls clear of the home indicator with safe-area padding.
- Use finite motion, and disable nonessential animation for reduced-motion settings.

## Shared data conventions

- Listing, community-post, comment, report, and message counts must come from their existing API records; local browsing history remains device-local.
- Community posts and market listings are separate content types and use separate detail routes.
- Hide private contact fields from profile summaries and public member views.

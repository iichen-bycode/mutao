const TAB_INDEX_BY_ROUTE = {
  'pages/index/index': 0,
  'pages/community-feed/community-feed': 1,
  'pages/publish/publish': 2,
  'pages/conversations/conversations': 3,
  'pages/me/me': 4
};

function syncCustomTabBar(page) {
  if (!page || typeof page.getTabBar !== 'function') return;
  const tabBar = page.getTabBar();
  if (!tabBar || typeof tabBar.setData !== 'function') return;

  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  const route = String(current && current.route || '').replace(/^\/+/, '');
  const selected = TAB_INDEX_BY_ROUTE[route];
  if (selected !== undefined) tabBar.setData({ selected });
}

module.exports = { syncCustomTabBar };

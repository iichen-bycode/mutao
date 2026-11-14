const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { formatListTime } = require('../../utils/format');

Page({
  data: { items: [], loading: true, error: false },
  onShow() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    this.setData({ loading: true, error: false });
    try {
      await ensureLogin();
      const items = await request('/users/me/community-post-comments', { silent: true });
      this.setData({ items: items.map((item) => Object.assign({}, item, { timeLabel: formatListTime(item.created_at), typeLabel: item.post_type_label || '社区帖子' })), loading: false });
    } catch (_error) { this.setData({ loading: false, error: true }); }
  },
  retry() { this.load(); },
  openPost(event) { wx.navigateTo({ url: '/pages/community-post-detail/community-post-detail?id=' + event.currentTarget.dataset.id }); },
  goCommunity() { wx.switchTab({ url: '/pages/community-feed/community-feed' }); }
});

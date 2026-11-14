const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { formatListTime } = require('../../utils/format');

const STATUS_LABELS = { open: '处理中', resolved: '已处理', dismissed: '未通过' };

Page({
  data: { items: [], loading: true, error: false },
  onShow() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    this.setData({ loading: true, error: false });
    try {
      await ensureLogin();
      const items = await request('/users/me/reports', { silent: true });
      this.setData({ items: items.map((item) => Object.assign({}, item, { statusLabel: STATUS_LABELS[item.status] || '状态更新中', timeLabel: formatListTime(item.created_at) })), loading: false });
    } catch (_error) { this.setData({ loading: false, error: true }); }
  },
  retry() { this.load(); },
  openListing(event) {
    const id = Number(event.currentTarget.dataset.id);
    if (id) wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },
  goBrowse() { wx.switchTab({ url: '/pages/community-feed/community-feed' }); }
});

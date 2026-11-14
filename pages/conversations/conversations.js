const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { formatListTime, avatarInitial } = require('../../utils/format');

Page({
  data: { items: [], loading: true, error: false },

  onShow() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },

  async load() {
    this.setData({ items: [], loading: true, error: false });
    try {
      await ensureLogin();
      const items = await request('/conversations', { silent: true });
      this.setData({
        items: items.map((item) => Object.assign({}, item, {
          timeLabel: formatListTime(item.last_message_at || item.updated_at),
          avatarInitial: avatarInitial(item.other_nickname)
        })),
        loading: false
      });
    } catch (_error) {
      this.setData({ loading: false, error: true });
    }
  },

  retry() { this.load(); },

  openChat(event) {
    const item = this.data.items.find((row) => Number(row.id) === Number(event.currentTarget.dataset.id));
    if (item) wx.navigateTo({ url: '/pages/chat/chat?id=' + item.id + '&title=' + encodeURIComponent(item.other_nickname || '邻居') });
  }
});

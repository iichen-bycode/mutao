const { readRecent, clearRecent } = require('../../utils/local-state');
const { formatListTime } = require('../../utils/format');

Page({
  data: { items: [], loading: true },

  onShow() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },

  load() {
    this.setData({ loading: true });
    const items = readRecent().map((item) => Object.assign({}, item, { viewedLabel: formatListTime(item.viewedAt) }));
    setTimeout(() => this.setData({ items, loading: false }), 180);
  },

  openDetail(event) { wx.navigateTo({ url: '/pages/detail/detail?id=' + event.currentTarget.dataset.id }); },
  onImageError(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({ items: this.data.items.map((item) => Number(item.id) === id ? Object.assign({}, item, { imageError: true }) : item) });
  },

  clear() {
    if (!this.data.items.length) return;
    wx.showModal({ title: '清空浏览记录', content: '清空后，这些最近看过的好物将从本机移除。', success: (result) => {
      if (!result.confirm) return;
      clearRecent();
      this.setData({ items: [] });
    } });
  },

  goBrowse() { wx.switchTab({ url: '/pages/index/index' }); }
});

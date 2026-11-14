const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');

Page({
  data: { items: [], loading: true, error: false, loggedOut: false },

  onShow() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },

  async load() {
    this.setData({ loading: true, error: false, loggedOut: false });
    try {
      const token = await ensureLogin();
      if (!token) {
        this.setData({ items: [], loading: false, loggedOut: true });
        return;
      }
      const result = await request('/users/me/favorites', { silent: true });
      const items = (Array.isArray(result) ? result : []).map((item) => Object.assign({}, item, {
        imageError: false,
        cover: Array.isArray(item.images) && item.images.length ? item.images[0] : ''
      }));
      this.setData({ items, loading: false });
    } catch (_error) {
      this.setData({ loading: false, error: true });
    }
  },

  retry() { this.load(); },
  async login() {
    try {
      await ensureLogin({ force: true });
      this.load();
    } catch (_error) {
      wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
    }
  },
  openItem(event) {
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },
  onImageError(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({ items: this.data.items.map((item) => Number(item.id) === id ? Object.assign({}, item, { imageError: true }) : item) });
  },
  goBrowse() { wx.switchTab({ url: '/pages/index/index' }); }
});

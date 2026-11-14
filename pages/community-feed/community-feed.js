const app = getApp();
const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { formatListTime, avatarInitial } = require('../../utils/format');

Page({
  data: { selection: null, items: [], total: 0, loading: true, error: false, categoryId: '', categories: [], favoriteBusyId: 0 },

  onLoad() {
    this.syncSelection();
    this.loadCategories();
    this.refresh();
  },

  onShow() {
    const selection = app.globalData.communitySelection || wx.getStorageSync('communitySelection') || { mode: 'all', location: null };
    const previousKey = this.selectionKey(this.data.selection);
    this.setData({ selection });
    if (previousKey && previousKey !== this.selectionKey(selection)) this.refresh();
  },

  onPullDownRefresh() { this.refresh().finally(() => wx.stopPullDownRefresh()); },

  selectionKey(selection) {
    const location = selection && selection.location;
    return selection && selection.mode === 'selected' && location ? [location.name, location.latitude, location.longitude].join('|') : 'all';
  },

  syncSelection() {
    this.setData({ selection: app.globalData.communitySelection || wx.getStorageSync('communitySelection') || { mode: 'all', location: null } });
  },

  openCommunity() { wx.navigateTo({ url: '/pages/community/community' }); },
  goPublish() { wx.switchTab({ url: '/pages/publish/publish' }); },
  openDetail(event) { wx.navigateTo({ url: '/pages/detail/detail?id=' + event.currentTarget.dataset.id }); },
  onImageError(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({ items: this.data.items.map((item) => Number(item.id) === id ? Object.assign({}, item, { imageError: true }) : item) });
  },
  onAvatarError(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({ items: this.data.items.map((item) => Number(item.id) === id ? Object.assign({}, item, { avatarError: true }) : item) });
  },

  async loadCategories() {
    try { this.setData({ categories: await request('/categories', { silent: true }) }); } catch (_error) {}
  },

  selectCategory(event) {
    const categoryId = String(event.currentTarget.dataset.id || '');
    if (categoryId === this.data.categoryId) return;
    this.setData({ categoryId });
    this.refresh();
  },

  async refresh() {
    this.feedSequence = (this.feedSequence || 0) + 1;
    const sequence = this.feedSequence;
    this.setData({ items: [], total: 0, loading: true, error: false });
    const selection = app.globalData.communitySelection || this.data.selection || { mode: 'all', location: null };
    const query = ['page=1', 'pageSize=20'];
    if (this.data.categoryId) query.push('categoryId=' + encodeURIComponent(this.data.categoryId));
    if (selection.mode === 'selected' && selection.location) {
      const location = selection.location;
      query.push('communityName=' + encodeURIComponent(location.name || ''));
      query.push('communityAddress=' + encodeURIComponent(location.address || ''));
      query.push('communityLatitude=' + encodeURIComponent(location.latitude));
      query.push('communityLongitude=' + encodeURIComponent(location.longitude));
    }
    try {
      const result = await request('/listings?' + query.join('&'), { silent: true });
      if (sequence !== this.feedSequence) return;
      let favoriteIds = [];
      if (wx.getStorageSync('sessionToken')) {
        try { favoriteIds = (await request('/users/me/favorites', { silent: true })).map((item) => Number(item.id)); } catch (_error) {}
      }
      if (sequence !== this.feedSequence) return;
      const favoriteSet = new Set(favoriteIds);
      const items = result.items.map((item) => Object.assign({}, item, {
        timeLabel: formatListTime(item.created_at || item.published_at),
        avatarInitial: avatarInitial(item.seller_nickname),
        favorited: favoriteSet.has(Number(item.id))
      }));
      this.setData({ items, total: Number(result.total || 0), loading: false });
    } catch (_error) {
      if (sequence === this.feedSequence) this.setData({ loading: false, error: true });
    }
  },

  async toggleFavorite(event) {
    const id = Number(event.currentTarget.dataset.id);
    const item = this.data.items.find((entry) => Number(entry.id) === id);
    if (!item || this.data.favoriteBusyId) return;
    this.setData({ favoriteBusyId: id });
    try {
      await ensureLogin();
      const result = await request('/listings/' + id + '/favorite', { method: 'PUT', data: { enabled: !item.favorited } });
      const items = this.data.items.map((entry) => Number(entry.id) === id ? Object.assign({}, entry, { favorited: result.favorited }) : entry);
      this.setData({ items });
      wx.showToast({ title: result.favorited ? '已收藏' : '已取消收藏', icon: 'success' });
    } catch (_error) {
    } finally { this.setData({ favoriteBusyId: 0 }); }
  }
});

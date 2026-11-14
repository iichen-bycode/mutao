const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { avatarInitial } = require('../../utils/format');
const { readRecent, readDraft } = require('../../utils/local-state');

const STATUS_LABELS = { pending: '待审核', published: '已发布', sold: '已售出', rejected: '未通过', removed: '已下架' };
const STATUS_FILTERS = ['all', 'pending', 'published', 'sold', 'rejected', 'removed'];

Page({
  data: { profile: null, listings: [], visibleListings: [], recent: [], hasDraft: false, loading: true, error: false, mode: 'listings', statusFilter: 'all', markingId: 0 },

  onShow() {
    this.setData({ recent: readRecent().slice(0, 6), hasDraft: Boolean(readDraft()) });
    const savedMode = wx.getStorageSync('meActiveMode');
    if ((savedMode === 'listings' || savedMode === 'favorites') && savedMode !== this.data.mode) this.setData({ mode: savedMode });
    this.load();
  },

  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },

  async load() {
    this.setData({ profile: wx.getStorageSync('profile') || null, listings: [], visibleListings: [], loading: true, error: false });
    try {
      await ensureLogin();
      const profile = wx.getStorageSync('profile') || {};
      const path = this.data.mode === 'favorites' ? '/users/me/favorites' : '/users/me/listings';
      const listings = await request(path, { silent: true });
      this.setData({
        profile: Object.assign({}, profile, { initial: avatarInitial(profile.nickname) }),
        listings: listings.map((item) => Object.assign({}, item, { statusLabel: STATUS_LABELS[item.status] || '状态更新中' })),
        loading: false
      });
      this.applyStatusFilter();
    } catch (_error) {
      this.setData({ loading: false, error: true });
    }
  },

  retry() { this.load(); },

  async markSold(event) {
    const id = Number(event.currentTarget.dataset.id);
    if (!id || this.data.markingId) return;
    const result = await new Promise((resolve) => wx.showModal({ title: '确认已售出？', content: '售出后，邻居会看到这条信息的状态更新。', success: resolve }));
    if (!result.confirm) return;
    this.setData({ markingId: id });
    try {
      await request('/listings/' + id + '/sold', { method: 'PUT' });
      wx.showToast({ title: '已更新为售出', icon: 'success' });
      await this.load();
    } catch (_error) {
    } finally { this.setData({ markingId: 0 }); }
  },

  goMessages() { wx.switchTab({ url: '/pages/conversations/conversations' }); },
  goPublish() { wx.switchTab({ url: '/pages/publish/publish' }); },
  goBrowse() { wx.switchTab({ url: '/pages/index/index' }); },
  goHistory() { wx.navigateTo({ url: '/pages/history/history' }); },
  goCommunity() { wx.switchTab({ url: '/pages/community-feed/community-feed' }); },
  goSettings() { wx.navigateTo({ url: '/pages/settings/settings' }); },
  goDraft() { wx.switchTab({ url: '/pages/publish/publish' }); },

  switchMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode !== 'listings' && mode !== 'favorites') return;
    wx.setStorageSync('meActiveMode', mode);
    this.setData({ mode, statusFilter: 'all' });
    this.load();
  },

  switchStatus(event) {
    const statusFilter = String(event.currentTarget.dataset.status || 'all');
    if (STATUS_FILTERS.indexOf(statusFilter) < 0) return;
    this.setData({ statusFilter });
    this.applyStatusFilter();
  },

  applyStatusFilter() {
    const visibleListings = this.data.mode === 'favorites' || this.data.statusFilter === 'all'
      ? this.data.listings
      : this.data.listings.filter((item) => item.status === this.data.statusFilter);
    this.setData({ visibleListings });
  },

  openDetail(event) { wx.navigateTo({ url: '/pages/detail/detail?id=' + event.currentTarget.dataset.id }); },
  onImageError(event) {
    const id = Number(event.currentTarget.dataset.id);
    const listings = this.data.listings.map((item) => Number(item.id) === id ? Object.assign({}, item, { imageError: true }) : item);
    const visibleListings = this.data.visibleListings.map((item) => Number(item.id) === id ? Object.assign({}, item, { imageError: true }) : item);
    this.setData({ listings, visibleListings });
  },
  onRecentImageError(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({ recent: this.data.recent.map((item) => Number(item.id) === id ? Object.assign({}, item, { imageError: true }) : item) });
  }
});

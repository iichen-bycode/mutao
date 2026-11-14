const app = getApp();
const { request } = require('../../utils/request');
const { ensureLogin, isSignedOut } = require('../../utils/auth');
const { avatarInitial } = require('../../utils/format');
const { readDraft } = require('../../utils/local-state');
const { syncCustomTabBar } = require('../../utils/tab-bar');
const { chooseCommunityLocation, isLocationCancel } = require('../../utils/community-picker');

const STATUS_LABELS = { pending: '待审核', published: '已发布', sold: '已转出', rejected: '未通过', hidden: '已下架', removed: '已下架' };
const STATUS_FILTERS = ['all', 'pending', 'published', 'sold', 'rejected', 'hidden', 'removed'];

function buildPostColumns(items) {
  const columns = [[], []];
  const heights = [0, 0];
  items.forEach((item) => {
    const titleLines = Math.min(2, Math.max(1, Math.ceil(String(item.title || '').length / 17)));
    const excerptLines = item.content ? Math.min(3, Math.max(1, Math.ceil(String(item.content).length / 23))) : 0;
    const imageHeight = item.cover && !item.imageError ? 220 : 0;
    const estimatedHeight = 112 + imageHeight + titleLines * 28 + excerptLines * 23 + (item.status !== 'published' ? 38 : 0);
    const columnIndex = heights[0] <= heights[1] ? 0 : 1;
    columns[columnIndex].push(item);
    heights[columnIndex] += estimatedHeight + 12;
  });
  return columns;
}

Page({
  data: {
    profile: null,
    counts: { listings: 0, posts: 0, favorites: 0, sold: 0, pendingListings: 0, conversations: 0, comments: 0, reports: 0 },
    communityName: '尚未加入小区', joinedCommunity: null, communityBusy: false, listings: [], visibleListings: [], postColumns: [[], []], hasDraft: false,
    loading: true, error: false, loggedOut: false, mode: 'listings', statusFilter: 'all', markingId: 0
  },

  onShow() {
    syncCustomTabBar(this);
    const joinedCommunity = app.globalData.joinedCommunity || wx.getStorageSync('joinedCommunity');
    const communityName = joinedCommunity ? joinedCommunity.name || joinedCommunity.address || '已加入小区' : '尚未加入小区';
    const savedMode = wx.getStorageSync('meActiveMode');
    const mode = ['listings', 'posts'].indexOf(savedMode) >= 0 ? savedMode : this.data.mode;
    this.setData({ hasDraft: Boolean(readDraft()), joinedCommunity: joinedCommunity || null, communityName, mode });
    if (this.hasLoadedOnce) return;
    this.hasLoadedOnce = true;
    this.load();
  },

  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },

  async load() {
    if (isSignedOut()) {
      this.setData({ profile: null, listings: [], visibleListings: [], loading: false, error: false, loggedOut: true });
      return;
    }
    this.loadSequence = (this.loadSequence || 0) + 1;
    const sequence = this.loadSequence;
    this.setData({ profile: wx.getStorageSync('profile') || null, loading: true, error: false });
    try {
      const token = await ensureLogin();
      if (!token) {
        this.setData({ profile: null, loading: false, loggedOut: true });
        return;
      }
      const paths = { listings: '/users/me/listings', posts: '/users/me/community-posts' };
      const [summaryResult, listResult, settingsResult] = await Promise.allSettled([
        request('/users/me/summary', { silent: true }),
        request(paths[this.data.mode] || paths.listings, { silent: true }),
        request('/users/me/settings', { silent: true })
      ]);
      if (sequence !== this.loadSequence) return;
      let profile = this.data.profile || {};
      let counts = this.data.counts;
      if (settingsResult.status === 'fulfilled') {
        const joinedCommunity = settingsResult.value && settingsResult.value.joinedCommunity || null;
        app.setJoinedCommunity(joinedCommunity);
        this.setData({ joinedCommunity, communityName: joinedCommunity ? joinedCommunity.name || joinedCommunity.address || '已加入小区' : '尚未加入小区' });
      }
      if (summaryResult.status === 'fulfilled') {
        const summary = summaryResult.value || {};
        profile = summary.user || profile;
        counts = Object.assign({}, counts, summary.counts || {});
        if (profile && profile.nickname) profile.initial = avatarInitial(profile.nickname);
        wx.setStorageSync('profile', profile);
      }
      if (listResult.status !== 'fulfilled') {
        this.setData({ profile, counts, loading: false, error: true });
        return;
      }
      const items = (listResult.value || []).map((item) => Object.assign({}, item, {
        statusLabel: STATUS_LABELS[item.status] || '状态更新中', imageError: false,
        cover: Array.isArray(item.images) && item.images.length ? item.images[0] : '',
        typeLabel: item.post_type_label || '社区帖子'
      }));
      this.setData({ profile, counts, listings: items, loading: false, error: false, loggedOut: false });
      this.applyStatusFilter();
    } catch (_error) {
      if (sequence === this.loadSequence) this.setData({ loading: false, error: true });
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

  selectMode(mode, statusFilter) {
    if (['listings', 'posts'].indexOf(mode) < 0) return;
    wx.setStorageSync('meActiveMode', mode);
    this.setData({ mode, statusFilter: statusFilter || 'all' });
    this.load();
  },

  switchMode(event) { this.selectMode(String(event.currentTarget.dataset.mode || ''), 'all'); },

  switchStatus(event) {
    const statusFilter = String(event.currentTarget.dataset.status || 'all');
    if (STATUS_FILTERS.indexOf(statusFilter) < 0) return;
    this.setData({ statusFilter });
    this.applyStatusFilter();
  },

  applyStatusFilter() {
    const visibleListings = this.data.statusFilter === 'all'
      ? this.data.listings
      : this.data.listings.filter((item) => item.status === this.data.statusFilter || (this.data.statusFilter === 'hidden' && item.status === 'removed'));
    this.setData({ visibleListings, postColumns: this.data.mode === 'posts' ? buildPostColumns(visibleListings) : [[], []] });
  },

  openQuickAction(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'pending') this.selectMode('listings', 'pending');
    else if (action === 'sold') this.selectMode('listings', 'sold');
    else if (action === 'comments') this.goComments();
  },

  goPublish() { wx.switchTab({ url: '/pages/publish/publish' }); },
  goBrowse() { wx.switchTab({ url: '/pages/index/index' }); },
  goHistory() { wx.navigateTo({ url: '/pages/history/history' }); },
  goFavorites() { wx.navigateTo({ url: '/pages/favorites/favorites' }); },
  editJoinedCommunity() {
    if (this.data.communityBusy) return;
    if (!this.data.joinedCommunity) return this.chooseJoinedCommunity();
    wx.showActionSheet({
      itemList: ['更换加入的小区', '退出当前小区'],
      success: (result) => {
        if (result.tapIndex === 0) this.chooseJoinedCommunity();
        else if (result.tapIndex === 1) this.leaveJoinedCommunity();
      }
    });
  },

  async chooseJoinedCommunity() {
    if (this.data.communityBusy) return;
    this.setData({ communityBusy: true });
    try {
      const location = await chooseCommunityLocation();
      const settings = await request('/users/me/settings', { method: 'PUT', data: { joinedCommunity: location }, silent: true });
      const joinedCommunity = settings.joinedCommunity || location;
      app.setJoinedCommunity(joinedCommunity);
      this.setData({ joinedCommunity, communityName: joinedCommunity.name || joinedCommunity.address || '已加入小区' });
      wx.showToast({ title: '已加入小区', icon: 'success' });
    } catch (error) {
      if (error && error.code === 'PRIVACY_DENIED') wx.showToast({ title: '同意位置隐私授权后，才能选择小区', icon: 'none' });
      else if (!isLocationCancel(error)) wx.showToast({ title: '加入小区失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ communityBusy: false });
    }
  },

  leaveJoinedCommunity() {
    if (this.data.communityBusy) return;
    wx.showModal({
      title: '退出当前小区',
      content: '退出后，社区帖子将不再发布到这个小区。',
      confirmText: '退出小区',
      success: async (result) => {
        if (!result.confirm || this.data.communityBusy) return;
        this.setData({ communityBusy: true });
        try {
          await request('/users/me/settings', { method: 'PUT', data: { joinedCommunity: null }, silent: true });
          app.setJoinedCommunity(null);
          this.setData({ joinedCommunity: null, communityName: '尚未加入小区' });
          wx.showToast({ title: '已退出小区', icon: 'success' });
        } catch (_error) {
          wx.showToast({ title: '退出失败，请稍后重试', icon: 'none' });
        } finally {
          this.setData({ communityBusy: false });
        }
      }
    });
  },
  goPostsFeed() { wx.navigateTo({ url: '/pages/community-posts/community-posts' }); },
  goCreatePost() { wx.navigateTo({ url: '/pages/community-post-create/community-post-create' }); },
  goSettings() { wx.navigateTo({ url: '/pages/settings/settings' }); },
  goEditProfile() { wx.navigateTo({ url: '/pages/profile-edit/profile-edit' }); },
  goDraft() { wx.switchTab({ url: '/pages/publish/publish' }); },
  goReports() { wx.navigateTo({ url: '/pages/my-reports/my-reports' }); },
  goComments() { wx.navigateTo({ url: '/pages/my-comments/my-comments' }); },

  openItem(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    if (this.data.mode === 'posts') wx.navigateTo({ url: '/pages/community-post-detail/community-post-detail?id=' + id });
    else wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  onImageError(event) {
    const id = Number(event.currentTarget.dataset.id);
    const listings = this.data.listings.map((item) => Number(item.id) === id ? Object.assign({}, item, { imageError: true }) : item);
    const visibleListings = this.data.visibleListings.map((item) => Number(item.id) === id ? Object.assign({}, item, { imageError: true }) : item);
    this.setData({ listings, visibleListings, postColumns: this.data.mode === 'posts' ? buildPostColumns(visibleListings) : [[], []] });
  },

  markSold(event) {
    const id = Number(event.currentTarget.dataset.id);
    if (!id || this.data.markingId) return;
    wx.showModal({ title: '确认已转出？', content: '转出后，邻居会看到这件物品的状态更新。', success: async (result) => {
      if (!result.confirm) return;
      this.setData({ markingId: id });
      try {
        await request('/listings/' + id + '/sold', { method: 'PUT' });
        wx.showToast({ title: '已更新为转出', icon: 'success' });
        await this.load();
      } catch (_error) {
      } finally { this.setData({ markingId: 0 }); }
    } });
  }
});

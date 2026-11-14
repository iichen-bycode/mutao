const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { avatarInitial, formatListTime } = require('../../utils/format');

const PAGE_SIZE = 20;

function decorateListings(items) {
  return items.map((item) => Object.assign({}, item, {
    images: Array.isArray(item.images) ? item.images : [],
    timeLabel: formatListTime(item.created_at),
    communityLabel: item.community_name || '邻里好物',
    imageError: false,
  }));
}

function decoratePosts(items) {
  return items.map((item) => Object.assign({}, item, {
    images: Array.isArray(item.images) ? item.images : [],
    timeLabel: formatListTime(item.created_at),
    communityLabel: item.community_name || '邻里社区',
    typeLabel: item.post_type_label || '社区动态',
    imageError: false,
  }));
}

Page({
  data: {
    id: 0, profile: null, stats: { listingCount: 0, postCount: 0, successfulTransfers: 0 },
    isSelf: false, mode: 'listings', listings: [], posts: [], total: 0,
    loading: true, contentLoading: true, contentError: false, profileUnavailable: false, loadingMore: false, hasMore: false,
    messaging: false, reporting: false, avatarError: false,
  },

  onLoad(options) {
    this.userId = Number(options.id);
    if (!Number.isSafeInteger(this.userId) || this.userId <= 0) {
      this.setData({ loading: false, contentLoading: false, contentError: true });
      return;
    }
    this.load();
  },

  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { this.loadMore(); },

  async load(mode = this.data.mode) {
    const sequence = (this.loadSequence || 0) + 1;
    this.loadSequence = sequence;
    this.setData({ loading: true, contentLoading: true, contentError: false, profileUnavailable: false, loadingMore: false, listings: [], posts: [], total: 0, hasMore: false });
    try {
      const [result, content] = await Promise.all([
        request('/users/' + this.userId + '/profile', { silent: true }),
        request('/users/' + this.userId + '/' + (mode === 'listings' ? 'public-listings' : 'posts') + '?page=1&pageSize=' + PAGE_SIZE, { silent: true }),
      ]);
      if (sequence !== this.loadSequence) return;
      const profile = Object.assign({}, result.user, { initial: avatarInitial(result.user && result.user.nickname) });
      const currentUser = wx.getStorageSync('profile') || {};
      const isSelf = Number(currentUser.id) === Number(profile.id);
      const items = mode === 'listings' ? decorateListings(content.items || []) : decoratePosts(content.items || []);
      this.setData({
        profile,
        stats: result.stats || { listingCount: 0, postCount: 0, successfulTransfers: 0 },
        isSelf,
        avatarError: false,
        [mode]: items,
        total: Number(content.total || 0),
        hasMore: Boolean(content.hasMore),
        loading: false,
        contentLoading: false,
      });
    } catch (_error) {
      if (sequence !== this.loadSequence) return;
      if (_error && _error.code === 'PROFILE_VIEW_DISABLED') {
        this.setData({
          profile: null,
          stats: { listingCount: 0, postCount: 0, successfulTransfers: 0 },
          loading: false,
          contentLoading: false,
          contentError: false,
          profileUnavailable: true,
        });
      } else {
        this.setData({ loading: false, contentLoading: false, contentError: true });
      }
    }
  },

  async loadMore() {
    if (!this.userId || this.data.loading || this.data.loadingMore || !this.data.hasMore) return;
    const mode = this.data.mode;
    const sequence = this.loadSequence;
    const page = Math.floor(this.data[mode].length / PAGE_SIZE) + 1;
    this.setData({ loadingMore: true });
    try {
      const path = mode === 'listings' ? 'public-listings' : 'posts';
      const result = await request('/users/' + this.userId + '/' + path + '?page=' + page + '&pageSize=' + PAGE_SIZE, { silent: true });
      if (sequence !== this.loadSequence || mode !== this.data.mode) return;
      const items = mode === 'listings' ? decorateListings(result.items || []) : decoratePosts(result.items || []);
      this.setData({ [mode]: this.data[mode].concat(items), hasMore: Boolean(result.hasMore), total: Number(result.total || this.data.total), loadingMore: false });
    } catch (_error) {
      if (sequence !== this.loadSequence) return;
      this.setData({ loadingMore: false });
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
    }
  },

  switchMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if ((mode !== 'listings' && mode !== 'posts') || mode === this.data.mode || this.data.loading) return;
    this.setData({ mode, contentLoading: true, contentError: false, profileUnavailable: false, loadingMore: false, total: 0, hasMore: false });
    this.load(mode);
  },

  retry() { this.load(); },

  openListing(event) { wx.navigateTo({ url: '/pages/detail/detail?id=' + event.currentTarget.dataset.id }); },

  async messageUser() {
    if (this.data.isSelf || this.data.messaging || !this.userId) return;
    this.setData({ messaging: true });
    try {
      const token = await ensureLogin();
      if (!token) return wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
      const result = await request('/conversations', { method: 'POST', data: { userId: this.userId } });
      wx.navigateTo({ url: '/pages/chat/chat?id=' + result.id + '&title=' + encodeURIComponent(this.data.profile.nickname || '邻居') });
    } catch (_error) {
    } finally { this.setData({ messaging: false }); }
  },

  reportUser() {
    if (this.data.isSelf || this.data.reporting || !this.userId) return;
    wx.showModal({
      title: '举报这个用户',
      editable: true,
      placeholderText: '请说明举报原因',
      success: async (result) => {
        const reason = String(result.content || '').trim();
        if (!result.confirm || this.data.reporting) return;
        if (!reason) return wx.showToast({ title: '请填写举报原因', icon: 'none' });
        this.setData({ reporting: true });
        try {
          const token = await ensureLogin();
          if (!token) return wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
          await request('/users/' + this.userId + '/report', { method: 'POST', data: { reason } });
          wx.showToast({ title: '举报已提交', icon: 'success' });
        } catch (_error) {
        } finally { this.setData({ reporting: false }); }
      },
    });
  },

  onListingImageError(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({ listings: this.data.listings.map((item) => Number(item.id) === id ? Object.assign({}, item, { imageError: true }) : item) });
  },

  onAvatarError() { this.setData({ avatarError: true }); },

  onPostImageError(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({ posts: this.data.posts.map((item) => Number(item.id) === id ? Object.assign({}, item, { imageError: true }) : item) });
  },
});

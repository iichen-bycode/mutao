const app = getApp();
const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { formatListTime, avatarInitial } = require('../../utils/format');
const { chooseCommunityLocation, isLocationCancel } = require('../../utils/community-picker');
const { syncCustomTabBar } = require('../../utils/tab-bar');

Page({
  data: {
    selection: null, filters: [{ id: 'all', name: '全部' }], activeType: 'all', items: [], total: 0,
    announcements: [], neighbors: [], neighborTotal: 0, loading: true, error: false,
    loadingMore: false, hasMore: false, selectingCommunity: false
  },

  onLoad() {
    this.syncSelection();
    this.refresh();
  },

  async loadPostCategories() {
    try {
      const categories = await request('/community/post-categories', { silent: true });
      const filters = [{ id: 'all', name: '全部' }].concat((categories || []).map((item) => ({ id: item.code, name: item.name })));
      const previousType = this.data.activeType;
      const activeType = filters.some((item) => item.id === previousType) ? previousType : 'all';
      this.setData({ filters, activeType });
      if (activeType !== previousType) this.refresh();
    } catch (_error) { }
  },

  onShow() {
    syncCustomTabBar(this);
    this.loadPostCategories();
    const previousKey = this.selectionKey(this.data.selection);
    this.syncSelection();
    if (this.returnFromPost || (previousKey && previousKey !== this.selectionKey(this.data.selection))) {
      this.returnFromPost = false;
      this.refresh();
    }
  },

  onPullDownRefresh() { this.refresh().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { this.loadMore(); },

  syncSelection() {
    this.setData({ selection: app.globalData.communityFeedSelection || wx.getStorageSync('communityFeedSelection') || { mode: 'all', location: null } });
  },

  selectionKey(selection) {
    const location = selection && selection.location;
    return selection && selection.mode === 'selected' && location ? [location.name, location.latitude, location.longitude].join('|') : 'all';
  },

  async chooseCommunity() {
    if (this.data.selectingCommunity) return;
    this.setData({ selectingCommunity: true });
    try {
      const location = await chooseCommunityLocation();
      app.setCommunityFeedSelection(location);
      this.setData({ selection: { mode: 'selected', location }, selectingCommunity: false });
      await this.refresh();
    } catch (error) {
      if (error && error.code === 'PRIVACY_DENIED') wx.showToast({ title: '同意位置隐私授权后，才能使用地图选点', icon: 'none' });
      else if (!isLocationCancel(error)) wx.showToast({ title: '无法打开地图，请检查微信的位置权限', icon: 'none' });
    } finally {
      if (this.data.selectingCommunity) this.setData({ selectingCommunity: false });
    }
  },

  clearCommunity(event) {
    if (event && event.stopPropagation) event.stopPropagation();
    app.clearCommunityFeedSelection();
    this.setData({ selection: { mode: 'all', location: null } });
    this.refresh();
  },

  selectType(event) {
    const activeType = String(event.currentTarget.dataset.id || 'all');
    if (activeType === this.data.activeType) return;
    this.setData({ activeType });
    this.refresh();
  },

  async refresh() {
    this.feedSequence = (this.feedSequence || 0) + 1;
    const sequence = this.feedSequence;
    this.setData({ items: [], total: 0, announcements: [], neighbors: [], neighborTotal: 0, loading: true, error: false, loadingMore: false, hasMore: false });
    return this.fetchPage(1, true, sequence);
  },

  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) return;
    return this.fetchPage(Math.floor(this.data.items.length / 20) + 1, false, this.feedSequence || 0);
  },

  async fetchPage(page, replace, sequence) {
    if (!replace && this.data.loadingMore) return;
    this.setData(replace ? { loading: true, error: false } : { loadingMore: true });
    const query = ['page=' + page, 'pageSize=20', 'type=' + encodeURIComponent(this.data.activeType)];
    const selection = app.globalData.communityFeedSelection || this.data.selection || { mode: 'all', location: null };
    if (selection.mode === 'selected' && selection.location) {
      const location = selection.location;
      query.push('communityName=' + encodeURIComponent(location.name || ''));
      query.push('communityAddress=' + encodeURIComponent(location.address || ''));
      query.push('communityLatitude=' + encodeURIComponent(location.latitude));
      query.push('communityLongitude=' + encodeURIComponent(location.longitude));
    }
    try {
      const result = await request('/community/feed?' + query.join('&'), { silent: true });
      if (sequence !== this.feedSequence) return;
      const items = (result.items || []).map((item) => Object.assign({}, item, {
        key: item.item_kind + '-' + item.id,
        images: Array.isArray(item.images) ? item.images : [],
        timeLabel: formatListTime(item.activity_at || item.created_at),
        avatarInitial: avatarInitial(item.author_nickname),
        communityLabel: item.community_name || '邻里社区',
        typeLabel: item.post_type_label || '社区动态',
        liked: Boolean(item.liked), favorited: Boolean(item.favorited), imageError: false, avatarError: false
      }));
      this.setData({
        items: replace ? items : this.data.items.concat(items),
        total: Number(result.total || 0), page, hasMore: Boolean(result.hasMore),
        announcements: (result.announcements || this.data.announcements).map((item) => Object.assign({}, item, { startsLabel: formatListTime(item.starts_at) })),
        neighbors: (result.neighbors || []).map((neighbor) => Object.assign({}, neighbor, { initial: avatarInitial(neighbor.nickname) })),
        neighborTotal: Number(result.neighborTotal || 0), loading: false, loadingMore: false, error: false
      });
    } catch (_error) {
      if (sequence === this.feedSequence) this.setData({ loading: false, loadingMore: false, error: true });
    }
  },

  openActivity(event) {
    this.openPost(event.currentTarget.dataset.id);
  },

  openComments(event) {
    this.openPost(event.currentTarget.dataset.id);
  },

  openPost(id) {
    this.returnFromPost = true;
    wx.navigateTo({ url: '/pages/community-post-detail/community-post-detail?id=' + id });
  },

  onImageError(event) {
    const id = Number(event.currentTarget.dataset.id);
    const kind = event.currentTarget.dataset.kind;
    this.setData({ items: this.data.items.map((item) => Number(item.id) === id && item.item_kind === kind ? Object.assign({}, item, { imageError: true }) : item) });
  },

  onAvatarError(event) {
    const id = Number(event.currentTarget.dataset.id);
    const kind = event.currentTarget.dataset.kind;
    this.setData({ items: this.data.items.map((item) => Number(item.id) === id && item.item_kind === kind ? Object.assign({}, item, { avatarError: true }) : item) });
  },

  async toggleLike(event) {
    const id = Number(event.currentTarget.dataset.id);
    const item = this.data.items.find((entry) => Number(entry.id) === id && entry.item_kind === 'post');
    if (!item || this.likeBusyId) return;
    this.likeBusyId = id;
    try {
      const token = await ensureLogin();
      if (!token) return wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
      const result = await request('/community/posts/' + id + '/like', { method: 'PUT', data: { enabled: !item.liked } });
      this.setData({ items: this.data.items.map((entry) => Number(entry.id) === id && entry.item_kind === 'post' ? Object.assign({}, entry, { liked: result.liked, like_count: result.likeCount }) : entry) });
    } catch (_error) {
    } finally { this.likeBusyId = 0; }
  },

  async showMoreNeighbors() {
    const query = ['limit=50'];
    const selection = app.globalData.communityFeedSelection || this.data.selection || { mode: 'all' };
    if (selection.mode === 'selected' && selection.location) {
      const location = selection.location;
      query.push('communityName=' + encodeURIComponent(location.name || ''));
      query.push('communityAddress=' + encodeURIComponent(location.address || ''));
      query.push('communityLatitude=' + encodeURIComponent(location.latitude));
      query.push('communityLongitude=' + encodeURIComponent(location.longitude));
    }
    try {
      const result = await request('/community/neighbors?' + query.join('&'), { silent: true });
      const names = (result.items || []).map((neighbor) => neighbor.nickname || '邻居');
      const more = Number(result.total || 0) > names.length ? '，还有 ' + (Number(result.total) - names.length) + ' 位近期活跃邻居' : '';
      wx.showModal({ title: '小区邻居', content: names.length ? names.join('、') + more : '暂时还没有邻居动态', showCancel: false });
    } catch (_error) { wx.showToast({ title: '邻居列表暂时无法加载', icon: 'none' }); }
  },

  onShareAppMessage(event) {
    const dataset = event && event.target && event.target.dataset || {};
    const isPost = dataset.kind === 'post';
    return {
      title: dataset.title || '来看看睦淘的邻里动态',
      path: isPost ? '/pages/community-post-detail/community-post-detail?id=' + dataset.id : '/pages/detail/detail?id=' + dataset.id
    };
  }
});

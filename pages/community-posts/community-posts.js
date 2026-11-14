const app = getApp();
const { request } = require('../../utils/request');
const { formatListTime, avatarInitial } = require('../../utils/format');
const { chooseCommunityLocation, isLocationCancel } = require('../../utils/community-picker');

Page({
  data: { selection: null, items: [], page: 1, total: 0, hasMore: true, loading: true, loadingMore: false, error: false, selectingCommunity: false },
  onLoad() { this.syncSelection(); this.refresh(); },
  onShow() {
    const previousKey = this.selectionKey(this.data.selection);
    this.syncSelection();
    if (this.hasShown && previousKey === this.selectionKey(this.data.selection)) this.refresh();
    this.hasShown = true;
    if (previousKey && previousKey !== this.selectionKey(this.data.selection)) this.refresh();
  },
  onPullDownRefresh() { this.refresh().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { this.loadMore(); },
  syncSelection() { this.setData({ selection: app.globalData.communityFeedSelection || wx.getStorageSync('communityFeedSelection') || { mode: 'all', location: null } }); },
  selectionKey(selection) {
    const location = selection && selection.location;
    return selection && selection.mode === 'selected' && location ? [location.name, location.latitude, location.longitude].join('|') : 'all';
  },
  async goChooseCommunity() {
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
    } finally { if (this.data.selectingCommunity) this.setData({ selectingCommunity: false }); }
  },
  clearCommunity(event) {
    if (event && event.stopPropagation) event.stopPropagation();
    app.clearCommunityFeedSelection();
    this.setData({ selection: { mode: 'all', location: null } });
    this.refresh();
  },
  goCreate() { wx.navigateTo({ url: '/pages/community-post-create/community-post-create' }); },
  openPost(event) { wx.navigateTo({ url: '/pages/community-post-detail/community-post-detail?id=' + event.currentTarget.dataset.id }); },
  async refresh() {
    this.feedSequence = (this.feedSequence || 0) + 1;
    this.setData({ items: [], page: 1, total: 0, hasMore: true, loading: true, error: false });
    return this.fetchPage(1, this.feedSequence);
  },
  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) return;
    this.setData({ loadingMore: true });
    return this.fetchPage(this.data.page + 1, this.feedSequence || 0);
  },
  async fetchPage(page, sequence) {
    const query = ['page=' + page, 'pageSize=20'];
    const selection = app.globalData.communityFeedSelection || this.data.selection || { mode: 'all' };
    if (selection.mode === 'selected' && selection.location) {
      const location = selection.location;
      query.push('communityName=' + encodeURIComponent(location.name || ''));
      query.push('communityAddress=' + encodeURIComponent(location.address || ''));
      query.push('communityLatitude=' + encodeURIComponent(location.latitude));
      query.push('communityLongitude=' + encodeURIComponent(location.longitude));
    }
    try {
      const result = await request('/community/posts?' + query.join('&'), { silent: true });
      if (sequence !== this.feedSequence) return;
      const items = (result.items || []).map((item) => Object.assign({}, item, {
        authorInitial: avatarInitial(item.author_nickname),
        timeLabel: formatListTime(item.published_at || item.created_at),
        typeLabel: item.post_type_label || '社区帖子',
        imageError: false
      }));
      this.setData({ items: page === 1 ? items : this.data.items.concat(items), page, total: Number(result.total || 0), hasMore: Boolean(result.hasMore), loading: false, loadingMore: false, error: false });
    } catch (_error) {
      if (sequence === this.feedSequence) this.setData({ loading: false, loadingMore: false, error: true });
    }
  },
  retry() { this.refresh(); },
  onImageError(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({ items: this.data.items.map((item) => Number(item.id) === id ? Object.assign({}, item, { imageError: true }) : item) });
  }
});

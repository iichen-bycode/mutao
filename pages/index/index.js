const app = getApp();
const { request } = require('../../utils/request');
const { formatListTime } = require('../../utils/format');

Page({
  data: { selection: null, categories: [], categoryId: '', keyword: '', items: [], page: 1, total: 0, hasMore: true, loading: false, error: '' },

  onLoad() {
    this.syncSelection();
    request('/categories', { silent: true }).then((categories) => this.setData({ categories })).catch(() => {});
    this.refreshFeed();
  },

  onShow() { this.syncSelection(); },
  onPullDownRefresh() { this.refreshFeed().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { this.loadMore(); },

  syncSelection() {
    const selection = app.globalData.communitySelection || wx.getStorageSync('communitySelection') || { mode: 'all', location: null };
    this.setData({ selection });
  },

  openCommunity() { wx.navigateTo({ url: '/pages/community/community' }); },
  onSearchInput(event) { this.setData({ keyword: event.detail.value }); },
  onSearchConfirm() { this.refreshFeed(); },
  clearSearch() { this.setData({ keyword: '' }); this.refreshFeed(); },
  clearFilters() { this.setData({ keyword: '', categoryId: '' }); this.refreshFeed(); },
  selectCategory(event) {
    this.setData({ categoryId: String(event.currentTarget.dataset.id || '') });
    this.refreshFeed();
  },

  async refreshFeed() {
    this.feedSequence = (this.feedSequence || 0) + 1;
    const sequence = this.feedSequence;
    this.setData({ items: [], total: 0, page: 1, hasMore: true, error: '' });
    return this.fetchPage(1, true, sequence);
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    return this.fetchPage(this.data.page + 1, false, this.feedSequence || 0);
  },

  async fetchPage(page, replace, sequence) {
    if (this.data.loading && !replace) return;
    this.setData({ loading: true, error: '' });
    try {
      const selection = app.globalData.communitySelection || wx.getStorageSync('communitySelection') || { mode: 'all' };
      const query = ['page=' + page, 'pageSize=20'];
      if (selection.mode === 'selected' && selection.location) {
        const location = selection.location;
        query.push(
          'communityName=' + encodeURIComponent(location.name || ''),
          'communityAddress=' + encodeURIComponent(location.address || ''),
          'communityLatitude=' + encodeURIComponent(location.latitude),
          'communityLongitude=' + encodeURIComponent(location.longitude)
        );
      }
      if (this.data.categoryId) query.push('categoryId=' + encodeURIComponent(this.data.categoryId));
      if (this.data.keyword.trim()) query.push('keyword=' + encodeURIComponent(this.data.keyword.trim()));
      const result = await request('/listings?' + query.join('&'), { silent: true });
      if (sequence !== this.feedSequence) return;
      const pageItems = result.items.map((item) => Object.assign({}, item, {
        timeLabel: formatListTime(item.created_at || item.published_at)
      }));
      const items = replace ? pageItems : this.data.items.concat(pageItems);
      this.setData({ items, total: Number(result.total || items.length), page, hasMore: result.hasMore, loading: false });
    } catch (_error) {
      if (sequence === this.feedSequence) this.setData({ loading: false, error: '信息暂时无法加载，请重试' });
    }
  },

  openDetail(event) { wx.navigateTo({ url: '/pages/detail/detail?id=' + event.currentTarget.dataset.id }); },
  onImageError(event) {
    const id = Number(event.currentTarget.dataset.id);
    this.setData({ items: this.data.items.map((item) => Number(item.id) === id ? Object.assign({}, item, { imageError: true }) : item) });
  },
  goPublish() { wx.switchTab({ url: '/pages/publish/publish' }); }
});

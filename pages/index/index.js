const app = getApp();
const { request } = require('../../utils/request');
const { formatListTime } = require('../../utils/format');
const { chooseCommunityLocation, isLocationCancel } = require('../../utils/community-picker');
const { syncCustomTabBar } = require('../../utils/tab-bar');

function formatCommunityName(selection) {
  const location = selection && selection.mode === 'selected' && selection.location;
  if (!location) return '全部小区';
  const name = String(location.name || location.address || '').trim() || '已选小区';
  const characters = Array.from(name);
  return characters.length > 8 ? characters.slice(0, 8).join('') + '…' : name;
}

Page({
  data: { greeting: '早上好', selection: null, communityName: '全部小区', categories: [], categoryId: '', keyword: '', items: [], nearbyItems: [], recommendedItems: [], moreItems: [], selectingCommunity: false, page: 1, total: 0, hasMore: true, loading: false, error: '' },

  onLoad() {
    this.syncSelection();
    request('/categories', { silent: true }).then((categories) => this.setData({ categories })).catch(() => {});
    this.refreshFeed();
  },

  onShow() {
    syncCustomTabBar(this);
    const previousKey = this.selectionKey(this.data.selection);
    this.syncSelection();
    if (previousKey && previousKey !== this.selectionKey(this.data.selection)) this.refreshFeed();
  },
  onPullDownRefresh() { this.refreshFeed().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { this.loadMore(); },

  syncSelection() {
    const selection = app.globalData.listingBrowseSelection || wx.getStorageSync('listingBrowseSelection') || { mode: 'all', location: null };
    this.setData({ selection, communityName: formatCommunityName(selection) });
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
      app.setListingBrowseSelection(location);
      const selection = { mode: 'selected', location };
      this.setData({ selection, communityName: formatCommunityName(selection), selectingCommunity: false });
      await this.refreshFeed();
    } catch (error) {
      if (error && error.code === 'PRIVACY_DENIED') wx.showToast({ title: '同意位置隐私授权后，才能使用地图选点', icon: 'none' });
      else if (!isLocationCancel(error)) wx.showToast({ title: '无法打开地图，请检查微信的位置权限', icon: 'none' });
    } finally {
      if (this.data.selectingCommunity) this.setData({ selectingCommunity: false });
    }
  },

  clearCommunity(event) {
    if (event && event.stopPropagation) event.stopPropagation();
    app.clearListingBrowseSelection();
    const selection = { mode: 'all', location: null };
    this.setData({ selection, communityName: formatCommunityName(selection) });
    this.refreshFeed();
  },

  goMessages() { wx.switchTab({ url: '/pages/conversations/conversations' }); },
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
      const selection = app.globalData.listingBrowseSelection || wx.getStorageSync('listingBrowseSelection') || { mode: 'all' };
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
      this.setData({
        items,
        nearbyItems: items.slice(0, 4),
        recommendedItems: items.slice(4, 6),
        moreItems: items.slice(6),
        total: Number(result.total || items.length), page, hasMore: result.hasMore, loading: false
      });
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

const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { rememberListing } = require('../../utils/local-state');
const app = getApp();

function distanceFromSelection(item, selection) {
  const location = selection && selection.mode === 'selected' && selection.location;
  const values = location && [location.latitude, location.longitude, item.community_latitude, item.community_longitude].map(Number);
  if (!values || values.some((value) => !Number.isFinite(value))) return '未选择位置';
  const toRadians = (value) => value * Math.PI / 180;
  const latitudeDelta = toRadians(values[2] - values[0]);
  const longitudeDelta = toRadians(values[3] - values[1]);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(values[0])) * Math.cos(toRadians(values[2])) * Math.sin(longitudeDelta / 2) ** 2;
  const meters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return meters < 100 ? '约' + Math.max(1, Math.round(meters)) + 'm' : '约' + (meters / 1000).toFixed(1) + 'km';
}

Page({
  data: { item: null, loading: true, error: false, galleryError: false, gallerySlides: [], galleryIndex: 0, favorite: false, favoriteBounce: false, markingSold: false },

  onLoad(options) { this.id = options.id; this.load(); },

  async load() {
    this.setData({ loading: true, error: false, galleryError: false });
    try {
      const item = await request('/listings/' + this.id, { silent: true });
      item.images = Array.isArray(item.images) ? item.images : [];
      const gallerySlides = item.images.map((url, index) => ({ url, index, failed: false }));
      item.seller_initial = String(item.seller_nickname || '邻').slice(0, 1);
      item.original_price_label = item.original_price === null || item.original_price === undefined ? '未填写' : '¥' + item.original_price;
      item.distance_label = distanceFromSelection(item, app.globalData.listingBrowseSelection || wx.getStorageSync('listingBrowseSelection'));
      rememberListing(item);
      const token = wx.getStorageSync('sessionToken');
      const favorite = token && !item.isOwner
        ? await request('/listings/' + this.id + '/favorite', { silent: true }).then((result) => result.favorited).catch(() => false)
        : false;
      this.setData({ item, favorite, gallerySlides, galleryIndex: 0, loading: false });
    } catch (_error) {
      this.setData({ loading: false, error: true });
    }
  },

  retry() { this.load(); },

  previewImage(event) {
    const current = event.currentTarget.dataset.current;
    if (!current || !this.data.item || !this.data.item.images.length) return;
    wx.previewImage({ current, urls: this.data.item.images });
  },

  onGalleryChange(event) { this.setData({ galleryIndex: event.detail.current || 0 }); },

  onGalleryError(event) {
    const index = Number(event.currentTarget.dataset.index);
    const gallerySlides = this.data.gallerySlides.map((slide) => slide.index === index ? Object.assign({}, slide, { failed: true }) : slide);
    this.setData({ gallerySlides });
  },

  openSellerProfile() {
    const item = this.data.item;
    if (!item || item.isOwner || !item.sellerId) return;
    wx.navigateTo({ url: '/pages/profile/profile?id=' + item.sellerId });
  },

  async messageSeller() {
    if (this.data.item && this.data.item.isOwner) return wx.showToast({ title: '这是你发布的信息', icon: 'none' });
    try {
      const token = await ensureLogin();
      if (!token) return wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
      const conversation = await request('/conversations', { method: 'POST', data: { listingId: this.id } });
      wx.navigateTo({ url: '/pages/chat/chat?id=' + conversation.id + '&title=' + encodeURIComponent(this.data.item.seller_nickname || '邻居') });
    } catch (_error) {}
  },

  async toggleFavorite() {
    try {
      const token = await ensureLogin();
      if (!token) return wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
      const result = await request('/listings/' + this.id + '/favorite', { method: 'PUT', data: { enabled: !this.data.favorite } });
      if (this.favoriteTimer) clearTimeout(this.favoriteTimer);
      const item = Object.assign({}, this.data.item, { favorite_count: result.favoriteCount });
      this.setData({ item, favorite: result.favorited, favoriteBounce: Boolean(result.favorited) });
      if (result.favorited) this.favoriteTimer = setTimeout(() => this.setData({ favoriteBounce: false }), 460);
      wx.showToast({ title: result.favorited ? '已加入收藏' : '已取消收藏', icon: 'success' });
    } catch (_error) {}
  },

  callSeller() {
    const item = this.data.item;
    if (!item || !item.contact_value) return;
    if (item.contact_type === 'phone' || item.contact_type === 'both') {
      wx.makePhoneCall({ phoneNumber: item.contact_value });
    } else {
      wx.setClipboardData({ data: item.contact_value, success: () => wx.showToast({ title: '联系方式已复制', icon: 'success' }) });
    }
  },

  markSold() {
    if (this.data.markingSold) return;
    wx.showModal({
      title: '确认已售出？',
      content: '标记后，邻居会看到这件物品已经售出。',
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ markingSold: true });
        try {
          await request('/listings/' + this.id + '/sold', { method: 'PUT' });
          wx.showToast({ title: '已更新为售出', icon: 'success' });
          await this.load();
        } catch (_error) {
        } finally { this.setData({ markingSold: false }); }
      }
    });
  },

  report() {
    wx.showModal({
      title: '举报这条信息',
      editable: true,
      placeholderText: '请简要说明原因',
      success: async (result) => {
        const reason = String(result.content || '').trim();
        if (!result.confirm || !reason) return;
        try {
          const token = await ensureLogin();
          if (!token) return wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
          await request('/listings/' + this.id + '/report', { method: 'POST', data: { reason } });
          wx.showToast({ title: '已提交举报', icon: 'success' });
        } catch (_error) {}
      }
    });
  },

  onUnload() {
    if (this.favoriteTimer) clearTimeout(this.favoriteTimer);
  }
});

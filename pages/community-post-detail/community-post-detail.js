const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { avatarInitial, formatListTime } = require('../../utils/format');
const app = getApp();

function distanceFromSelection(post, selection) {
  const location = selection && selection.mode === 'selected' && selection.location;
  const coordinates = location && [location.latitude, location.longitude, post.community_latitude, post.community_longitude].map(Number);
  if (!coordinates || coordinates.some((value) => !Number.isFinite(value))) return '未选择位置';
  const radians = (value) => value * Math.PI / 180;
  const latitudeDelta = radians(coordinates[2] - coordinates[0]);
  const longitudeDelta = radians(coordinates[3] - coordinates[1]);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(coordinates[0])) * Math.cos(radians(coordinates[2])) * Math.sin(longitudeDelta / 2) ** 2;
  const meters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return meters < 100 ? '约' + Math.max(1, Math.round(meters)) + 'm' : '约' + (meters / 1000).toFixed(1) + 'km';
}

Page({
  data: { item: null, comments: [], commentText: '', loading: true, error: false, refreshing: false, commentsLoading: false, commentError: false, commentBusy: false, likeBusy: false, gallerySlides: [], galleryIndex: 0 },
  onLoad(options) { this.id = Number(options.id); this.load(); },
  onRefresherRefresh() {
    this.setData({ refreshing: true });
    this.load(true).finally(() => this.setData({ refreshing: false }));
  },
  async load(isRefresh) {
    this.setData({ loading: !isRefresh, error: false });
    try {
      const item = await request('/community/posts/' + this.id, { silent: true });
      item.images = Array.isArray(item.images) ? item.images : [];
      item.authorInitial = avatarInitial(item.author_nickname);
      item.timeLabel = formatListTime(item.published_at || item.created_at);
      item.distanceLabel = distanceFromSelection(item, app.globalData.communityFeedSelection || wx.getStorageSync('communityFeedSelection'));
      item.liked = Boolean(item.liked);
      this.setData({ item, gallerySlides: item.images.map((url, index) => ({ url, index, failed: false })), galleryIndex: 0, loading: false });
      await this.loadComments();
    } catch (_error) { this.setData({ loading: false, error: true }); }
  },
  async loadComments() {
    this.setData({ commentsLoading: true, commentError: false });
    try {
      const comments = await request('/community/posts/' + this.id + '/comments', { silent: true });
      this.setData({ comments: comments.map((comment) => Object.assign({}, comment, { initial: avatarInitial(comment.nickname), timeLabel: formatListTime(comment.created_at) })), commentsLoading: false });
    } catch (_error) { this.setData({ commentsLoading: false, commentError: true }); }
  },
  retry() { this.load(); },
  onCommentInput(event) { this.setData({ commentText: event.detail.value }); },
  async submitComment() {
    const content = String(this.data.commentText || '').trim();
    if (!content) return wx.showToast({ title: '先写下你的评论', icon: 'none' });
    if (this.data.commentBusy || !this.data.item || this.data.item.status !== 'published') return;
    this.setData({ commentBusy: true });
    try {
      const token = await ensureLogin();
      if (!token) return wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
      const comment = await request('/community/posts/' + this.id + '/comments', { method: 'POST', data: { content } });
      comment.initial = avatarInitial(comment.nickname);
      comment.timeLabel = formatListTime(comment.created_at);
      this.setData({ comments: this.data.comments.concat(comment), commentText: '', item: Object.assign({}, this.data.item, { comment_count: Number(this.data.item.comment_count || 0) + 1 }) });
      wx.showToast({ title: '评论已发布', icon: 'success' });
    } catch (_error) {
    } finally { this.setData({ commentBusy: false }); }
  },
  previewImage(event) {
    const current = event.currentTarget.dataset.current;
    if (current && this.data.item && this.data.item.images.length) wx.previewImage({ current, urls: this.data.item.images });
  },
  onGalleryChange(event) { this.setData({ galleryIndex: event.detail.current || 0 }); },
  onImageError(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({ gallerySlides: this.data.gallerySlides.map((slide) => slide.index === index ? Object.assign({}, slide, { failed: true }) : slide) });
  },
  async toggleLike() {
    if (!this.data.item || this.data.likeBusy || this.data.item.status !== 'published') return;
    this.setData({ likeBusy: true });
    try {
      const token = await ensureLogin();
      if (!token) return wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
      const result = await request('/community/posts/' + this.id + '/like', { method: 'PUT', data: { enabled: !this.data.item.liked } });
      this.setData({ item: Object.assign({}, this.data.item, { liked: result.liked, like_count: result.likeCount }) });
    } catch (_error) {
    } finally { this.setData({ likeBusy: false }); }
  },
  openAuthor() {
    if (!this.data.item || this.data.item.isOwner) return;
    wx.navigateTo({ url: '/pages/profile/profile?id=' + this.data.item.authorId });
  },
  async messageAuthor() {
    const item = this.data.item;
    if (!item || item.isOwner) return wx.showToast({ title: '这是你发布的帖子', icon: 'none' });
    try {
      const token = await ensureLogin();
      if (!token) return wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
      const conversation = await request('/conversations', { method: 'POST', data: { userId: item.authorId } });
      wx.navigateTo({ url: '/pages/chat/chat?id=' + conversation.id + '&title=' + encodeURIComponent(item.author_nickname || '邻居') });
    } catch (_error) {}
  },
  callAuthor() {
    const item = this.data.item;
    if (!item || !item.contact_value) return;
    if (item.contact_type === 'phone' || item.contact_type === 'both') wx.makePhoneCall({ phoneNumber: item.contact_value });
    else wx.setClipboardData({ data: item.contact_value, success: () => wx.showToast({ title: '联系方式已复制', icon: 'success' }) });
  }
});

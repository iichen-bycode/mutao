const { request } = require('../../utils/request');
const { ensureLogin, isSignedOut } = require('../../utils/auth');
const { formatListTime, avatarInitial } = require('../../utils/format');
const { syncCustomTabBar } = require('../../utils/tab-bar');

function toTime(value) {
  if (!value) return 0;
  const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value;
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : 0;
}

function buildItems(inbox) {
  const conversations = (inbox.conversations || []).map((item) => {
    const timestamp = item.last_message_at || item.updated_at;
    return Object.assign({}, item, {
      key: 'private-' + item.id,
      type: 'private',
      title: item.other_nickname || '邻居',
      preview: item.last_message || ('聊聊：' + (item.listing_title || '邻里好物')),
      timeLabel: formatListTime(timestamp),
      sortTime: toTime(timestamp),
      avatarInitial: avatarInitial(item.other_nickname),
      avatarTone: Number(item.id) % 4,
      unreadCount: Number(item.unread_count || 0)
    });
  });
  const notifications = (inbox.notifications || []).map((item) => ({
    key: 'system-' + item.id,
    id: item.id,
    type: 'system',
    title: item.title || '系统通知',
    preview: item.body || '',
    timeLabel: formatListTime(item.created_at),
    sortTime: toTime(item.created_at),
    unread: !Boolean(item.is_read),
    raw: item
  }));
  return conversations.concat(notifications).sort((a, b) => b.sortTime - a.sortTime);
}

Page({
  data: {
    activeFilter: 'all',
    statusBarHeight: 20,
    filters: [
      { key: 'all', label: '全部' },
      { key: 'private', label: '私聊' },
      { key: 'system', label: '系统通知' }
    ],
    items: [],
    visibleItems: [],
    skeletonRows: [1, 2, 3],
    unreadNotifications: 0,
    loading: true,
    error: false,
    loggedOut: false,
    markingAll: false
  },

  onLoad() {
    const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarHeight: systemInfo.statusBarHeight || 20 });
  },
  onShow() {
    syncCustomTabBar(this);
    if (this.hasLoadedOnce) return;
    this.hasLoadedOnce = true;
    this.load();
  },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },

  async load() {
    const sequence = (this.loadSequence || 0) + 1;
    this.loadSequence = sequence;
    if (isSignedOut()) {
      this.setData({ items: [], visibleItems: [], loading: false, error: false, loggedOut: true });
      return;
    }
    this.setData({ loading: true, error: false });
    try {
      const token = await ensureLogin();
      if (!token) {
        this.setData({ items: [], visibleItems: [], loading: false, loggedOut: true });
        return;
      }
      const inbox = await request('/messages/inbox', { silent: true });
      if (sequence !== this.loadSequence) return;
      const items = buildItems(inbox);
      this.setData({
        items,
        unreadNotifications: Number(inbox.unreadNotifications || 0),
        loading: false,
        error: false,
        loggedOut: false
      });
      this.applyFilter(this.data.activeFilter, items);
    } catch (_error) {
      if (sequence === this.loadSequence) this.setData({ loading: false, error: true });
    }
  },

  applyFilter(filter, items = this.data.items) {
    const visibleItems = filter === 'all' ? items : items.filter((item) => item.type === filter);
    this.setData({ activeFilter: filter, visibleItems });
  },

  selectFilter(event) {
    this.applyFilter(event.currentTarget.dataset.filter);
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

  async markNotificationRead(id) {
    const item = this.data.items.find((row) => row.type === 'system' && Number(row.id) === Number(id));
    if (!item || !item.unread) return;
    await request('/messages/notifications/' + id + '/read', { method: 'POST', silent: true });
    const items = this.data.items.map((row) => row.type === 'system' && Number(row.id) === Number(id) ? Object.assign({}, row, { unread: false }) : row);
    this.setData({ unreadNotifications: Math.max(0, this.data.unreadNotifications - 1) });
    this.applyFilter(this.data.activeFilter, items);
  },

  async markAllRead() {
    if (!this.data.unreadNotifications || this.data.markingAll) return;
    this.setData({ markingAll: true });
    try {
      await request('/messages/notifications/read', { method: 'POST', silent: true });
      const items = this.data.items.map((row) => row.type === 'system' ? Object.assign({}, row, { unread: false }) : row);
      this.setData({ items, unreadNotifications: 0, markingAll: false });
      this.applyFilter(this.data.activeFilter, items);
    } catch (_error) {
      this.setData({ markingAll: false });
      wx.showToast({ title: '暂时无法标记已读，请稍后重试', icon: 'none' });
    }
  },

  async openItem(event) {
    const item = this.data.items.find((row) => row.type === event.currentTarget.dataset.type && Number(row.id) === Number(event.currentTarget.dataset.id));
    if (!item) return;
    if (item.type === 'private') {
      wx.navigateTo({ url: '/pages/chat/chat?id=' + item.id + '&title=' + encodeURIComponent(item.title || '邻居') });
      return;
    }
    try {
      await this.markNotificationRead(item.id);
    } catch (_error) {
      wx.showToast({ title: '通知已打开，稍后再试标记已读', icon: 'none' });
    }
  }
});

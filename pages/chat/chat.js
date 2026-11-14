const app = getApp();
const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { formatClock, avatarInitial } = require('../../utils/format');

function dayKey(value) {
  if (!value) return '';
  const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
}

function dayLabel(value) {
  if (!value) return '';
  const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const difference = Math.round((today - messageDay) / 86400000);
  if (difference === 0) return '今天';
  if (difference === 1) return '昨天';
  return (date.getMonth() + 1) + '月' + date.getDate() + '日';
}

function decorateMessages(messages, userId) {
  let previousDay = '';
  return messages.map((message) => {
    const key = dayKey(message.created_at);
    const decorated = Object.assign({}, message, {
      timeLabel: formatClock(message.created_at),
      dateLabel: key && key !== previousDay ? dayLabel(message.created_at) : '',
      isMine: Number(message.sender_id) === Number(userId)
    });
    previousDay = key;
    return decorated;
  });
}

Page({
  data: {
    id: '', statusBarHeight: 20, conversation: null, messages: [], draft: '', canSend: false,
    connectionState: 'connecting', otherOnline: false, loadingHistory: true, historyError: false,
    sending: false, myUserId: 0, scrollTarget: ''
  },

  onLoad(options) {
    const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ id: options.id || '', statusBarHeight: systemInfo.statusBarHeight || 20 });
    this.start();
  },

  onShow() {
    if (this.data.connectionState === 'disconnected' && !this.data.loadingHistory) this.start();
  },

  async start() {
    this.failPendingSend();
    this.startSequence = (this.startSequence || 0) + 1;
    const sequence = this.startSequence;
    if (this.socket) {
      try { this.socket.close({ code: 1000, reason: 'reconnect' }); } catch (_error) {}
      this.socket = null;
    }
    this.setData({ connectionState: 'connecting', otherOnline: false, loadingHistory: true, historyError: false });
    try {
      const token = await ensureLogin();
      if (sequence !== this.startSequence) return;
      if (!token) {
        this.setData({ connectionState: 'disconnected', loadingHistory: false, historyError: true });
        wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
        return;
      }
      const profile = wx.getStorageSync('profile') || {};
      const userId = Number(profile.id || 0);
      this.setData({ myUserId: userId });
      const [conversation, messages] = await Promise.all([
        request('/conversations/' + this.data.id, { silent: true }),
        request('/conversations/' + this.data.id + '/messages?page=1&pageSize=50', { silent: true })
      ]);
      if (sequence !== this.startSequence) return;
      conversation.otherInitial = avatarInitial(conversation.otherNickname);
      conversation.priceLabel = Number(conversation.listingPrice || 0).toFixed(2).replace(/\.?0+$/, '');
      this.setData({
        conversation,
        messages: decorateMessages(messages, userId),
        loadingHistory: false
      });
      this.markRead();
      this.scrollToLatest();

      const socket = wx.connectSocket({ url: app.globalData.websocketUrl, protocols: [] });
      this.socket = socket;
      socket.onOpen(() => {
        if (sequence !== this.startSequence) return;
        this.setData({ connectionState: 'connected' });
        this.sendEvent('auth', { token });
        this.sendEvent('conversation:join', { conversationId: Number(this.data.id) });
      });
      socket.onMessage((event) => {
        if (sequence !== this.startSequence) return;
        let packet;
        try { packet = JSON.parse(event.data); } catch (_error) { return; }
        if (!packet.data || Number(packet.data.conversationId || packet.data.conversation_id) !== Number(this.data.id)) return;
        if (packet.event === 'presence:state') {
          if (Number(packet.data.userId) !== this.data.myUserId) this.setData({ otherOnline: Boolean(packet.data.online) });
          return;
        }
        if (packet.event !== 'message:new' || Number(packet.data.conversation_id) !== Number(this.data.id)) return;
        const duplicate = this.data.messages.some((message) => Number(message.id) === Number(packet.data.id));
        if (duplicate) return;
        const messages = decorateMessages(this.data.messages.concat(packet.data), this.data.myUserId);
        this.setData({ messages });
        if (Number(packet.data.sender_id) !== this.data.myUserId) {
          this.markRead();
        }
        if (Number(packet.data.sender_id) === this.data.myUserId && this.pendingBody === packet.data.body) {
          this.pendingBody = null;
          if (this.sendTimer) clearTimeout(this.sendTimer);
          this.sendTimer = null;
          const draft = this.data.draft === packet.data.body ? '' : this.data.draft;
          this.setData({ draft, canSend: Boolean(draft.trim()), sending: false });
        }
        this.scrollToLatest();
      });
      socket.onError(() => {
        if (sequence === this.startSequence) {
          this.failPendingSend();
          this.setData({ connectionState: 'disconnected', otherOnline: false });
        }
      });
      socket.onClose(() => {
        if (sequence === this.startSequence) {
          this.failPendingSend();
          this.setData({ connectionState: 'disconnected', otherOnline: false });
        }
      });
    } catch (_error) {
      if (sequence === this.startSequence) this.setData({ connectionState: 'disconnected', loadingHistory: false, historyError: true });
    }
  },

  sendEvent(event, data) {
    if (!this.socket) return;
    try { this.socket.send({ data: JSON.stringify({ event, data }) }); } catch (_error) {}
  },

  scrollToLatest() {
    const messages = this.data.messages;
    if (!messages.length) return;
    this.setData({ scrollTarget: 'message-' + messages[messages.length - 1].id });
  },

  markRead() {
    if (this.readTimer) clearTimeout(this.readTimer);
    const conversationId = this.data.id;
    this.readTimer = setTimeout(() => {
      request('/conversations/' + conversationId + '/read', { method: 'POST', silent: true }).catch(() => {});
      this.readTimer = null;
    }, 220);
  },

  failPendingSend() {
    if (!this.pendingBody) return;
    this.pendingBody = null;
    if (this.sendTimer) clearTimeout(this.sendTimer);
    this.sendTimer = null;
    if (this.readTimer) clearTimeout(this.readTimer);
    this.readTimer = null;
    this.setData({ sending: false });
  },

  input(event) {
    const draft = event.detail.value;
    this.setData({ draft, canSend: Boolean(draft.trim()) });
  },

  retry() { this.start(); },

  quickReply() {
    wx.showActionSheet({
      itemList: ['方便自提吗？', '什么时候方便看？', '好的，谢谢！'],
      success: (result) => {
        const phrases = ['方便自提吗？', '什么时候方便看？', '好的，谢谢！'];
        const draft = this.data.draft ? this.data.draft + phrases[result.tapIndex] : phrases[result.tapIndex];
        this.setData({ draft, canSend: Boolean(draft.trim()) });
      }
    });
  },

  send() {
    const body = this.data.draft.trim();
    if (!body || this.data.sending) return;
    if (!this.socket || this.data.connectionState !== 'connected') return wx.showToast({ title: '消息服务未连接，请稍后重试', icon: 'none' });
    const socket = this.socket;
    const sendSequence = this.startSequence;
    this.pendingBody = body;
    this.setData({ sending: true });
    try {
      socket.send({
        data: JSON.stringify({ event: 'message:send', data: { conversationId: Number(this.data.id), body } }),
        success: () => {
          if (sendSequence !== this.startSequence || this.pendingBody !== body) return;
          this.sendTimer = setTimeout(() => {
            if (this.pendingBody !== body) return;
            this.failPendingSend();
            wx.showToast({ title: '暂未确认发送成功，消息仍在输入框里', icon: 'none' });
          }, 8000);
        },
        fail: () => {
          if (sendSequence !== this.startSequence || this.pendingBody !== body) return;
          this.failPendingSend();
          wx.showToast({ title: '发送失败，消息还在输入框里', icon: 'none' });
        }
      });
    } catch (_error) {
      this.failPendingSend();
      wx.showToast({ title: '发送失败，消息还在输入框里', icon: 'none' });
    }
  },

  back() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/conversations/conversations' });
  },

  openListing() {
    if (this.data.conversation && this.data.conversation.listingId) {
      wx.navigateTo({ url: '/pages/detail/detail?id=' + this.data.conversation.listingId });
    }
  },

  callOther() {
    const phone = this.data.conversation && this.data.conversation.otherPhone;
    if (phone) wx.makePhoneCall({ phoneNumber: phone });
  },

  onUnload() {
    this.startSequence = (this.startSequence || 0) + 1;
    this.pendingBody = null;
    if (this.sendTimer) clearTimeout(this.sendTimer);
    this.sendTimer = null;
    if (this.socket) this.socket.close({ code: 1000, reason: 'page closed' });
  }
});

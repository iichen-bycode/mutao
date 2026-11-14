const app = getApp();
const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { formatClock } = require('../../utils/format');

Page({
  data: { id: '', title: '邻里聊天', messages: [], draft: '', canSend: false, connectionState: 'connecting', loadingHistory: true, historyError: false, sending: false, myUserId: 0 },

  onLoad(options) {
    let title = options.title || '邻里聊天';
    try { title = decodeURIComponent(title); } catch (_error) {}
    this.setData({ id: options.id || '', title });
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
    this.setData({ connectionState: 'connecting', loadingHistory: true, historyError: false });
    try {
      const token = await ensureLogin();
      if (sequence !== this.startSequence) return;
      const profile = wx.getStorageSync('profile') || {};
      this.setData({ myUserId: Number(profile.id || 0) });
      const messages = await request('/conversations/' + this.data.id + '/messages?page=1&pageSize=50', { silent: true });
      if (sequence !== this.startSequence) return;
      this.setData({ messages: messages.map((message) => Object.assign({}, message, { timeLabel: formatClock(message.created_at), isMine: Number(message.sender_id) === Number(profile.id) })), loadingHistory: false });
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
        if (packet.event !== 'message:new' || !packet.data || Number(packet.data.conversation_id) !== Number(this.data.id)) return;
        const duplicate = this.data.messages.some((message) => Number(message.id) === Number(packet.data.id));
        if (duplicate) return;
        const message = Object.assign({}, packet.data, { timeLabel: formatClock(packet.data.created_at), isMine: Number(packet.data.sender_id) === this.data.myUserId });
        this.setData({ messages: this.data.messages.concat(message) });
        if (message.isMine && this.pendingBody === message.body) {
          this.pendingBody = null;
          if (this.sendTimer) clearTimeout(this.sendTimer);
          this.sendTimer = null;
          const draft = this.data.draft === message.body ? '' : this.data.draft;
          this.setData({ draft, canSend: Boolean(draft.trim()), sending: false });
        }
        this.scrollToLatest();
      });
      socket.onError(() => {
        if (sequence === this.startSequence) {
          this.failPendingSend();
          this.setData({ connectionState: 'disconnected' });
        }
      });
      socket.onClose(() => {
        if (sequence === this.startSequence) {
          this.failPendingSend();
          this.setData({ connectionState: 'disconnected' });
        }
      });
    } catch (_error) {
      if (sequence === this.startSequence) this.setData({ connectionState: 'disconnected', loadingHistory: false, historyError: true });
    }
  },

  sendEvent(event, data) {
    const socket = this.socket;
    if (!socket) return;
    try { socket.send({ data: JSON.stringify({ event, data }) }); } catch (_error) {}
  },

  scrollToLatest() { setTimeout(() => wx.pageScrollTo({ scrollTop: 999999, duration: 150 }), 60); },
  failPendingSend() {
    if (!this.pendingBody) return;
    this.pendingBody = null;
    if (this.sendTimer) clearTimeout(this.sendTimer);
    this.sendTimer = null;
    this.setData({ sending: false });
  },
  input(event) {
    const draft = event.detail.value;
    this.setData({ draft, canSend: Boolean(draft.trim()) });
  },
  retry() { this.start(); },

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

  onUnload() {
    this.startSequence = (this.startSequence || 0) + 1;
    this.pendingBody = null;
    if (this.sendTimer) clearTimeout(this.sendTimer);
    this.sendTimer = null;
    if (this.socket) this.socket.close({ code: 1000, reason: 'page closed' });
  }
});

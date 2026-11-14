const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { avatarInitial } = require('../../utils/format');

Page({
  data: { profile: null, nickname: '', loading: true, error: false, saving: false },
  onLoad() { this.load(); },
  async load() {
    this.setData({ loading: true, error: false });
    try {
      const token = await ensureLogin();
      if (!token) {
        this.setData({ loading: false, error: true });
        return;
      }
      const profile = await request('/users/me', { silent: true });
      profile.initial = avatarInitial(profile.nickname);
      this.setData({ profile, nickname: profile.nickname || '', loading: false });
    } catch (_error) { this.setData({ loading: false, error: true }); }
  },
  onInput(event) { this.setData({ nickname: event.detail.value }); },
  async save() {
    const nickname = String(this.data.nickname || '').trim();
    if (!nickname) return wx.showToast({ title: '昵称不能为空', icon: 'none' });
    if (nickname.length > 80) return wx.showToast({ title: '昵称不能超过 80 个字符', icon: 'none' });
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      const profile = await request('/users/me', { method: 'PUT', data: { nickname } });
      profile.initial = avatarInitial(profile.nickname);
      wx.setStorageSync('profile', profile);
      this.setData({ profile, nickname: profile.nickname || nickname, saving: false });
      wx.showToast({ title: '资料已更新', icon: 'success' });
      setTimeout(() => wx.navigateBack({ delta: 1 }), 450);
    } catch (_error) { this.setData({ saving: false }); }
  },
  retry() { this.load(); }
});

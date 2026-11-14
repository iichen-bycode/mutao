const app = getApp();
const { request } = require('../../utils/request');
const { ensureLogin, signOut } = require('../../utils/auth');
const { readRecent, clearRecent, readDraft } = require('../../utils/local-state');
const { chooseCommunityLocation, isLocationCancel } = require('../../utils/community-picker');

const DEFAULT_SETTINGS = {
  pushNotifications: true,
  privateMessages: true,
  interactionNotifications: true,
  communityNotices: false,
  allowProfileViews: true,
  showLocation: true,
  personalizedRecommendations: false,
  themeMode: 'system',
  joinedCommunity: null
};

const THEME_LABELS = { system: '跟随系统', light: '浅色模式', dark: '深色模式' };

function maskPhone(phone) {
  const value = String(phone || '');
  return value.length >= 7 ? value.slice(0, 3) + '****' + value.slice(-4) : '立即绑定';
}

function savedFiles() {
  return new Promise((resolve) => {
    if (!wx.getSavedFileList) return resolve([]);
    wx.getSavedFileList({ success: (result) => resolve(result.fileList || []), fail: () => resolve([]) });
  });
}

function readableSize(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / (1024 * 1024)).toFixed(1) + ' MB';
}

Page({
  data: {
    profile: {},
    settings: Object.assign({}, DEFAULT_SETTINGS),
    loading: true,
    error: false,
    busyKey: '',
    phoneBusy: false,
    editingPhone: false,
    phoneDraft: '',
    cacheBusy: false,
    cacheSizeText: '计算中',
    joinedCommunity: null,
    communityName: '尚未加入小区',
    communityBusy: false,
    recentCount: 0,
    themeClass: '',
    themeLabel: THEME_LABELS.system,
    year: new Date().getFullYear()
  },

  onShow() {
    this.setData({ recentCount: readRecent().length });
    this.updateCacheSize();
    this.load();
  },

  onHide() {
    if (this.updateCheckTimer) clearTimeout(this.updateCheckTimer);
    this.updateCheckTimer = null;
    wx.hideLoading();
    if (wx.setNavigationBarColor) wx.setNavigationBarColor({ frontColor: '#604A4A', backgroundColor: '#FFF7F4' });
  },

  async load() {
    this.setData({ loading: true, error: false });
    try {
      const token = await ensureLogin();
      if (!token) {
        this.setData({ loading: false, error: true });
        return;
      }
      const [profile, settings] = await Promise.all([
        request('/users/me', { silent: true }),
        request('/users/me/settings', { silent: true })
      ]);
      const nextSettings = Object.assign({}, DEFAULT_SETTINGS, settings || {});
      const joinedCommunity = nextSettings.joinedCommunity || null;
      app.setJoinedCommunity(joinedCommunity);
      const profileWithInitial = Object.assign({}, profile, {
        initial: String(profile.nickname || '邻').slice(0, 1),
        maskedPhone: maskPhone(profile.phone)
      });
      wx.setStorageSync('profile', profileWithInitial);
      this.setData({
        profile: profileWithInitial,
        settings: nextSettings,
        joinedCommunity,
        communityName: joinedCommunity ? joinedCommunity.name || joinedCommunity.address || '已加入小区' : '尚未加入小区',
        loading: false
      });
      this.applyTheme(nextSettings.themeMode);
    } catch (_error) {
      this.setData({ loading: false, error: true });
    }
  },

  retry() { this.load(); },

  async updatePreference(key, value) {
    if (this.data.busyKey) return;
    const previousSettings = Object.assign({}, this.data.settings);
    const settings = Object.assign({}, previousSettings, { [key]: value });
    this.setData({ settings, busyKey: key });
    if (key === 'themeMode') this.applyTheme(value);
    try {
      const result = await request('/users/me/settings', { method: 'PUT', data: { [key]: value }, silent: true });
      this.setData({ settings: Object.assign({}, DEFAULT_SETTINGS, result || {}) });
      if (key === 'themeMode') this.applyTheme(result && result.themeMode || value);
    } catch (_error) {
      this.setData({ settings: previousSettings });
      if (key === 'themeMode') this.applyTheme(previousSettings.themeMode);
      wx.showToast({ title: '保存失败，请检查网络后重试', icon: 'none' });
    } finally {
      this.setData({ busyKey: '' });
    }
  },

  toggleSetting(event) {
    const key = String(event.currentTarget.dataset.key || '');
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key) || key === 'themeMode') return;
    if (this.data.busyKey) {
      this.setData({ ['settings.' + key]: this.data.settings[key] });
      return;
    }
    this.updatePreference(key, Boolean(event.detail.value));
  },

  chooseTheme() {
    if (this.data.busyKey) return;
    wx.showActionSheet({
      itemList: ['跟随系统', '浅色模式', '深色模式'],
      success: (result) => {
        const mode = ['system', 'light', 'dark'][result.tapIndex];
        if (mode && mode !== this.data.settings.themeMode) this.updatePreference('themeMode', mode);
      }
    });
  },

  applyTheme(mode) {
    let isDark = mode === 'dark';
    if (mode === 'system') {
      try { isDark = wx.getSystemInfoSync().theme === 'dark'; } catch (_error) { isDark = false; }
    }
    this.setData({ themeClass: isDark ? 'theme-dark' : '', themeLabel: THEME_LABELS[mode] || THEME_LABELS.system });
    if (wx.setNavigationBarColor) {
      wx.setNavigationBarColor({
        frontColor: isDark ? '#FFFFFF' : '#604A4A',
        backgroundColor: isDark ? '#242126' : '#FFF7F4',
        animation: { duration: 180, timingFunc: 'easeIn' }
      });
    }
  },

  editPhone() {
    if (this.data.phoneBusy) return;
    this.setData({ editingPhone: true, phoneDraft: '' });
  },

  inputPhone(event) {
    const value = String(event.detail.value || '').replace(/\D/g, '').slice(0, 11);
    this.setData({ phoneDraft: value });
  },

  cancelPhoneEdit() {
    if (this.data.phoneBusy) return;
    this.setData({ editingPhone: false, phoneDraft: '' });
  },

  stopModalTap() {},

  async savePhone() {
    if (this.data.phoneBusy) return;
    const phone = String(this.data.phoneDraft || '').trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入有效的11位手机号', icon: 'none' });
      return;
    }
    this.setData({ phoneBusy: true });
    try {
      const profile = await request('/users/me/phone', { method: 'POST', data: { phone }, silent: true });
      const profileWithInitial = Object.assign({}, profile, {
        initial: String(profile.nickname || '邻').slice(0, 1),
        maskedPhone: maskPhone(profile.phone)
      });
      wx.setStorageSync('profile', profileWithInitial);
      this.setData({ profile: profileWithInitial, editingPhone: false, phoneDraft: '' });
      wx.showToast({ title: '手机号已保存', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error && error.message || '保存失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ phoneBusy: false });
    }
  },

  explainPassword() {
    wx.showModal({ title: '登录密码', content: '当前账号使用微信授权登录，没有单独的睦淘密码。请在微信中管理账号安全。', showCancel: false, confirmText: '知道了' });
  },

  editJoinedCommunity() {
    if (this.data.communityBusy) return;
    if (!this.data.joinedCommunity) return this.chooseJoinedCommunity();
    wx.showActionSheet({
      itemList: ['更换加入的小区', '退出当前小区'],
      success: (result) => {
        if (result.tapIndex === 0) this.chooseJoinedCommunity();
        else if (result.tapIndex === 1) this.leaveJoinedCommunity();
      }
    });
  },

  async chooseJoinedCommunity() {
    if (this.data.communityBusy) return;
    this.setData({ communityBusy: true });
    try {
      const location = await chooseCommunityLocation();
      const settings = await request('/users/me/settings', { method: 'PUT', data: { joinedCommunity: location }, silent: true });
      const joinedCommunity = settings.joinedCommunity || location;
      app.setJoinedCommunity(joinedCommunity);
      this.setData({
        joinedCommunity,
        communityName: joinedCommunity.name || joinedCommunity.address || '已加入小区',
        'settings.joinedCommunity': joinedCommunity
      });
      wx.showToast({ title: '已加入小区', icon: 'success' });
    } catch (error) {
      if (error && error.code === 'PRIVACY_DENIED') wx.showToast({ title: '同意位置隐私授权后，才能选择小区', icon: 'none' });
      else if (!isLocationCancel(error)) wx.showToast({ title: '加入小区失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ communityBusy: false });
    }
  },

  leaveJoinedCommunity() {
    if (this.data.communityBusy) return;
    wx.showModal({
      title: '退出当前小区',
      content: '退出后，社区帖子将不再发布到这个小区。',
      confirmText: '退出小区',
      success: async (result) => {
        if (!result.confirm || this.data.communityBusy) return;
        this.setData({ communityBusy: true });
        try {
          await request('/users/me/settings', { method: 'PUT', data: { joinedCommunity: null }, silent: true });
          app.setJoinedCommunity(null);
          this.setData({
            joinedCommunity: null,
            communityName: '尚未加入小区',
            'settings.joinedCommunity': null
          });
          wx.showToast({ title: '已退出小区', icon: 'success' });
        } catch (_error) {
          wx.showToast({ title: '退出失败，请稍后重试', icon: 'none' });
        } finally {
          this.setData({ communityBusy: false });
        }
      }
    });
  },

  showDocument(event) {
    const kind = event.currentTarget.dataset.kind;
    const documents = {
      help: ['帮助中心', '如需帮助，请通过下方“联系客服”与睦淘团队联系。请勿向他人提供验证码或微信支付密码。'],
      terms: ['用户协议', '请遵守社区规则，发布真实、合法的闲置信息，并在线下交易中选择安全、公开的地点。'],
      privacy: ['隐私政策', '睦淘仅在提供账号、发布和社区服务所需的范围内处理信息。手机号仅用于账号联系，不会公开展示。你可以在本页调整个人主页和位置信息。']
    };
    const document = documents[kind];
    if (document) wx.showModal({ title: document[0], content: document[1], showCancel: false, confirmText: '知道了' });
  },

  async updateCacheSize() {
    const files = await savedFiles();
    const draft = readDraft();
    const retained = new Set((draft && Array.isArray(draft.photos) ? draft.photos : []).map((photo) => photo.localPath).filter(Boolean));
    const bytes = files.reduce((total, file) => retained.has(file.filePath) ? total : total + Number(file.size || 0), 0);
    this.setData({ cacheSizeText: readableSize(bytes) });
  },

  async clearCache() {
    if (this.data.cacheBusy) return;
    const files = await savedFiles();
    const draft = readDraft();
    const retained = new Set((draft && Array.isArray(draft.photos) ? draft.photos : []).map((photo) => photo.localPath).filter(Boolean));
    const removable = files.filter((file) => !retained.has(file.filePath));
    if (!removable.length) {
      this.setData({ cacheSizeText: '0 B' });
      return wx.showToast({ title: '没有可清理的缓存', icon: 'none' });
    }
    const bytes = removable.reduce((total, file) => total + Number(file.size || 0), 0);
    wx.showModal({
      title: '清除缓存',
      content: `将清理 ${readableSize(bytes)} 的临时文件，不会删除登录信息、发布草稿或浏览记录。`,
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ cacheBusy: true });
        const results = await Promise.all(removable.map((file) => new Promise((resolve) => {
          if (!wx.removeSavedFile) return resolve(false);
          wx.removeSavedFile({ filePath: file.filePath, success: () => resolve(true), fail: () => resolve(false) });
        })));
        await this.updateCacheSize();
        this.setData({ cacheBusy: false });
        wx.showToast({ title: results.every(Boolean) ? '缓存已清理' : '部分临时文件未能清理', icon: results.every(Boolean) ? 'success' : 'none' });
      }
    });
  },

  clearHistory() {
    if (!this.data.recentCount) return wx.showToast({ title: '浏览记录已经清空', icon: 'none' });
    wx.showModal({ title: '清空浏览记录', content: '只会移除保存在本机的浏览记录。', success: (result) => {
      if (!result.confirm) return;
      clearRecent();
      this.setData({ recentCount: 0 });
      wx.showToast({ title: '已清空', icon: 'success' });
    } });
  },

  checkUpdate() {
    const manager = wx.getUpdateManager && wx.getUpdateManager();
    if (!manager) return wx.showToast({ title: '当前微信版本不支持检查更新', icon: 'none' });
    let checkReceived = false;
    this.updateCheckTimer = setTimeout(() => {
      this.updateCheckTimer = null;
      if (checkReceived) return;
      wx.hideLoading();
      wx.showModal({ title: '版本更新', content: '微信会在小程序启动时自动检查更新。当前版本：v1.0.2。', showCancel: false, confirmText: '知道了' });
    }, 1500);
    wx.showLoading({ title: '正在检查' });
    manager.onCheckForUpdate((result) => {
      checkReceived = true;
      if (this.updateCheckTimer) clearTimeout(this.updateCheckTimer);
      this.updateCheckTimer = null;
      wx.hideLoading();
      if (!result.hasUpdate) wx.showToast({ title: '已是最新版本', icon: 'success' });
    });
    manager.onUpdateReady(() => {
      checkReceived = true;
      if (this.updateCheckTimer) clearTimeout(this.updateCheckTimer);
      this.updateCheckTimer = null;
      wx.hideLoading();
      wx.showModal({ title: '发现新版本', content: '新版本已经准备好，是否立即重启应用？', success: (result) => { if (result.confirm) manager.applyUpdate(); } });
    });
    manager.onUpdateFailed(() => {
      checkReceived = true;
      if (this.updateCheckTimer) clearTimeout(this.updateCheckTimer);
      this.updateCheckTimer = null;
      wx.hideLoading();
      wx.showToast({ title: '更新下载失败，请稍后重试', icon: 'none' });
    });
  },

  logout() {
    wx.showModal({ title: '退出登录', content: '退出后，你需要重新授权微信登录才能使用个人功能。', success: (result) => {
      if (!result.confirm) return;
      signOut();
      wx.switchTab({ url: '/pages/me/me' });
    } });
  }
});

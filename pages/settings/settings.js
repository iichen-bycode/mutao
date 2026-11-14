const { clearRecent, readRecent, readDraft, clearDraft } = require('../../utils/local-state');

Page({
  data: { profile: null, recentCount: 0, hasDraft: false },
  onShow() {
    const profile = wx.getStorageSync('profile') || {};
    profile.initial = String(profile.nickname || '邻').slice(0, 1);
    this.setData({ profile, recentCount: readRecent().length, hasDraft: Boolean(readDraft()) });
  },
  openCommunity() { wx.navigateTo({ url: '/pages/community/community' }); },
  goPublish() { wx.switchTab({ url: '/pages/publish/publish' }); },
  clearHistory() {
    if (!this.data.recentCount) return wx.showToast({ title: '浏览记录已经清空', icon: 'none' });
    wx.showModal({ title: '清空浏览记录', content: '只会移除保存在本机的浏览记录。', success: (result) => {
      if (!result.confirm) return;
      clearRecent();
      this.setData({ recentCount: 0 });
      wx.showToast({ title: '已清空', icon: 'success' });
    } });
  },
  clearDraft() {
    if (!this.data.hasDraft) return wx.showToast({ title: '当前没有保存的草稿', icon: 'none' });
    wx.showModal({ title: '删除发布草稿', content: '删除后无法恢复这条草稿。', success: (result) => {
      if (!result.confirm) return;
      clearDraft();
      const pages = getCurrentPages();
      const publishPage = pages.find((page) => page.route === 'pages/publish/publish');
      if (publishPage && publishPage.resetDraft) publishPage.resetDraft();
      this.setData({ hasDraft: false });
      wx.showToast({ title: '草稿已删除', icon: 'success' });
    } });
  }
});

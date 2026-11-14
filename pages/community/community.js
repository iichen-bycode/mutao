const app = getApp();

Page({
  data: { selection: null, selecting: false },

  onLoad() {
    this.setData({ selection: app.globalData.listingBrowseSelection || wx.getStorageSync('listingBrowseSelection') || { mode: 'all', location: null } });
  },

  async chooseLocation() {
    if (this.data.selecting) return;
    this.setData({ selecting: true });
    if (wx.requirePrivacyAuthorize) {
      try {
        await new Promise((resolve, reject) => wx.requirePrivacyAuthorize({ success: resolve, fail: reject }));
      } catch (_error) {
        this.setData({ selecting: false });
        wx.showToast({ title: '同意位置隐私授权后，才能使用地图选点', icon: 'none' });
        return;
      }
    }
    wx.chooseLocation({
      success: (location) => {
        app.setListingBrowseSelection(location);
        this.setData({ selection: { mode: 'selected', location }, selecting: false });
        const pages = getCurrentPages();
        const previous = pages[pages.length - 2];
        if (previous && previous.refreshFeed) previous.refreshFeed();
        wx.navigateBack({ delta: 1 });
      },
      fail: (error) => {
        this.setData({ selecting: false });
        if (error && error.errMsg && error.errMsg.indexOf('cancel') >= 0) return;
        wx.showToast({ title: '无法打开地图，请检查微信的位置权限', icon: 'none' });
      }
    });
  },

  chooseAll() {
    if (this.data.selecting) return;
    app.clearListingBrowseSelection();
    const pages = getCurrentPages();
    const previous = pages[pages.length - 2];
    if (previous && previous.refreshFeed) previous.refreshFeed();
    wx.navigateBack({ delta: 1 });
  }
});

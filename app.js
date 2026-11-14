const config = require('./utils/config');

App({
  globalData: { apiBaseUrl: config.apiBaseUrl, websocketUrl: config.websocketUrl, communitySelection: null },

  onLaunch() {
    const selection = wx.getStorageSync('communitySelection');
    const validSelection = selection && (selection.mode === 'all' || selection.mode === 'selected' && selection.location);
    this.globalData.communitySelection = validSelection ? selection : { mode: 'all', location: null };
    if (!validSelection) {
      wx.setStorageSync('communitySelection', this.globalData.communitySelection);
    }
  },

  selectCommunity(location) {
    const selection = { mode: 'selected', location };
    this.globalData.communitySelection = selection;
    wx.setStorageSync('communitySelection', selection);
  },

  clearCommunity() {
    this.globalData.communitySelection = { mode: 'all', location: null };
    wx.setStorageSync('communitySelection', this.globalData.communitySelection);
  }
});

const config = require('./utils/config');

App({
  globalData: {
    apiBaseUrl: config.apiBaseUrl,
    websocketUrl: config.websocketUrl,
    listingBrowseSelection: null,
    communityFeedSelection: null,
    joinedCommunity: null
  },

  onLaunch() {
    const legacySelection = wx.getStorageSync('communitySelection');
    const storedListingSelection = wx.getStorageSync('listingBrowseSelection') || legacySelection;
    const validListingSelection = storedListingSelection && (storedListingSelection.mode === 'all' || storedListingSelection.mode === 'selected' && storedListingSelection.location);
    this.globalData.listingBrowseSelection = validListingSelection ? storedListingSelection : { mode: 'all', location: null };
    wx.setStorageSync('listingBrowseSelection', this.globalData.listingBrowseSelection);

    const storedFeedSelection = wx.getStorageSync('communityFeedSelection');
    const validFeedSelection = storedFeedSelection && (storedFeedSelection.mode === 'all' || storedFeedSelection.mode === 'selected' && storedFeedSelection.location);
    this.globalData.communityFeedSelection = validFeedSelection ? storedFeedSelection : { mode: 'all', location: null };
    wx.setStorageSync('communityFeedSelection', this.globalData.communityFeedSelection);

    this.globalData.joinedCommunity = wx.getStorageSync('joinedCommunity') || null;
    wx.removeStorageSync('communitySelection');
  },

  setListingBrowseSelection(location) {
    const selection = { mode: 'selected', location };
    this.globalData.listingBrowseSelection = selection;
    wx.setStorageSync('listingBrowseSelection', selection);
  },

  clearListingBrowseSelection() {
    this.globalData.listingBrowseSelection = { mode: 'all', location: null };
    wx.setStorageSync('listingBrowseSelection', this.globalData.listingBrowseSelection);
  },

  setCommunityFeedSelection(location) {
    const selection = { mode: 'selected', location };
    this.globalData.communityFeedSelection = selection;
    wx.setStorageSync('communityFeedSelection', selection);
  },

  clearCommunityFeedSelection() {
    this.globalData.communityFeedSelection = { mode: 'all', location: null };
    wx.setStorageSync('communityFeedSelection', this.globalData.communityFeedSelection);
  },

  setJoinedCommunity(location) {
    this.globalData.joinedCommunity = location || null;
    if (location) wx.setStorageSync('joinedCommunity', location);
    else wx.removeStorageSync('joinedCommunity');
  }
});

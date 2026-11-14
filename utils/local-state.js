const RECENT_KEY = 'recentlyViewedListings';
const DRAFT_KEY = 'publishDraft';

function readRecent() {
  const items = wx.getStorageSync(RECENT_KEY);
  return Array.isArray(items) ? items : [];
}

function rememberListing(listing) {
  if (!listing || !listing.id) return;
  const next = [Object.assign({}, listing, { viewedAt: Date.now() })]
    .concat(readRecent().filter((item) => Number(item.id) !== Number(listing.id)))
    .slice(0, 30);
  wx.setStorageSync(RECENT_KEY, next);
}

function clearRecent() { wx.removeStorageSync(RECENT_KEY); }
function readDraft() { return wx.getStorageSync(DRAFT_KEY) || null; }
function writeDraft(draft) { wx.setStorageSync(DRAFT_KEY, Object.assign({}, draft, { savedAt: Date.now() })); }
function removeSavedPhoto(photo) {
  const root = wx.env && wx.env.USER_DATA_PATH;
  if (photo && photo.localPath && root && photo.localPath.indexOf(root) === 0 && wx.removeSavedFile) {
    wx.removeSavedFile({ filePath: photo.localPath, fail() {} });
  }
}
function clearDraft() {
  const draft = wx.getStorageSync(DRAFT_KEY);
  if (draft && Array.isArray(draft.photos)) draft.photos.forEach(removeSavedPhoto);
  wx.removeStorageSync(DRAFT_KEY);
}

module.exports = { readRecent, rememberListing, clearRecent, readDraft, writeDraft, clearDraft, removeSavedPhoto };

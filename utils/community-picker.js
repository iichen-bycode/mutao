async function chooseCommunityLocation() {
  if (wx.requirePrivacyAuthorize) {
    try {
      await new Promise((resolve, reject) => wx.requirePrivacyAuthorize({ success: resolve, fail: reject }));
    } catch (_error) {
      const privacyError = new Error('privacy authorization denied');
      privacyError.code = 'PRIVACY_DENIED';
      throw privacyError;
    }
  }
  return new Promise((resolve, reject) => wx.chooseLocation({ success: resolve, fail: reject }));
}

function isLocationCancel(error) {
  return Boolean(error && error.errMsg && error.errMsg.indexOf('cancel') >= 0);
}

module.exports = { chooseCommunityLocation, isLocationCancel };

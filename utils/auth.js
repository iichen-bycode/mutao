const config = require('./config');
const { request } = require('./request');

const SIGNED_OUT_KEY = 'authSignedOut';

async function ensureLogin(options = {}) {
  if (options.force) wx.removeStorageSync(SIGNED_OUT_KEY);
  else if (wx.getStorageSync(SIGNED_OUT_KEY)) return null;
  let token = wx.getStorageSync('sessionToken');
  if (token) return token;
  let code;
  if (config.devMockLogin) code = 'dev:demo';
  else {
    const login = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
    code = login.code;
  }
  const result = await request('/auth/wechat', { method: 'POST', data: { code } });
  wx.setStorageSync('sessionToken', result.token);
  wx.setStorageSync('profile', result.user);
  return result.token;
}

function signOut() {
  wx.removeStorageSync('sessionToken');
  wx.removeStorageSync('profile');
  wx.removeStorageSync('joinedCommunity');
  const app = getApp();
  if (app && app.setJoinedCommunity) app.setJoinedCommunity(null);
  wx.setStorageSync(SIGNED_OUT_KEY, true);
}

function isSignedOut() { return Boolean(wx.getStorageSync(SIGNED_OUT_KEY)); }

module.exports = { ensureLogin, signOut, isSignedOut };

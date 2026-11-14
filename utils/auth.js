const config = require('./config');
const { request } = require('./request');

async function ensureLogin() {
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

module.exports = { ensureLogin };

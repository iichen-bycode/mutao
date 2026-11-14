const config = require('./config');

function request(path, options = {}) {
  const token = wx.getStorageSync('sessionToken');
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.apiBaseUrl + path,
      method: options.method || 'GET',
      data: options.data || {},
      header: Object.assign({ 'content-type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, options.header || {}),
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data);
        else {
          if (response.statusCode === 401) {
            wx.removeStorageSync('sessionToken');
            wx.removeStorageSync('profile');
          }
          const message = response.data && (response.data.message || response.data.error) || '请求失败';
          if (!options.silent) wx.showToast({ title: Array.isArray(message) ? message[0] : String(message), icon: 'none' });
          const requestError = new Error(Array.isArray(message) ? message[0] : String(message));
          requestError.code = response.data && response.data.code;
          reject(requestError);
        }
      },
      fail(error) {
        if (!options.silent) wx.showToast({ title: '无法连接服务，请检查网络和 API 地址', icon: 'none' });
        reject(error);
      }
    });
  });
}

module.exports = { request };

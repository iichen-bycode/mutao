const { request } = require('./request');

async function uploadImage(file, scope = 'listing') {
  // Load COS only when an upload starts, so a stale or missing NPM bundle cannot
  // prevent the publish page and the other tab pages from registering.
  const COS = require('cos-wx-sdk-v5');
  const fileSize = Number(file.size) > 0 ? Number(file.size) : await new Promise((resolve) => wx.getFileInfo({
    filePath: file.tempFilePath,
    success: (result) => resolve(Number(result.size) || 0),
    fail: () => resolve(0)
  }));
  const credential = await request('/uploads/credentials', { method: 'POST', data: { fileName: file.name || file.tempFilePath.split('/').pop(), scope } });
  const credentials = credential.credentials || credential;
  const cos = new COS({
    SecretId: credentials.tmpSecretId || credentials.TmpSecretId,
    SecretKey: credentials.tmpSecretKey || credentials.TmpSecretKey,
    SecurityToken: credentials.sessionToken || credentials.Token,
    StartTime: credential.startTime || credential.StartTime,
    ExpiredTime: credential.expiredTime || credential.ExpiredTime,
    SimpleUploadMethod: 'putObject'
  });
  return new Promise((resolve, reject) => {
    cos.uploadFile({
      Bucket: credential.bucket || credential.Bucket,
      Region: credential.region || credential.Region,
      Key: credential.key || credential.Key,
      FilePath: file.tempFilePath,
      FileSize: fileSize,
      SliceSize: 5 * 1024 * 1024
    }, (error, data) => error ? reject(error) : resolve({ key: credential.key || credential.Key, url: data && data.Location }));
  });
}

async function deleteUploadedImage(key) {
  return request('/uploads/remove', { method: 'POST', data: { key }, silent: true });
}

module.exports = { uploadImage, deleteUploadedImage };

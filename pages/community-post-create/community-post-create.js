const app = getApp();
const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { uploadImage, deleteUploadedImage } = require('../../utils/upload');
const { chooseCommunityLocation, isLocationCancel } = require('../../utils/community-picker');

Page({
  data: { selection: null, postType: '', postCategories: [], categoryLoading: true, categoryError: false, title: '', content: '', photos: [], uploading: false, uploadProgress: '', selectingCommunity: false, submitting: false },
  onLoad() { this.loadPostCategories(); },
  onShow() { this.syncSelection(); },
  async loadPostCategories() {
    this.setData({ categoryLoading: true, categoryError: false });
    try {
      const categories = await request('/community/post-categories', { silent: true });
      const postCategories = Array.isArray(categories) ? categories : [];
      const current = postCategories.some((item) => item.code === this.data.postType) ? this.data.postType : (postCategories[0] && postCategories[0].code || '');
      this.setData({ postCategories, postType: current, categoryLoading: false });
    } catch (_error) { this.setData({ categoryLoading: false, categoryError: true }); }
  },
  onUnload() {
    this.pageUnloading = true;
    if (this.data.submitting) return;
    (this.data.photos || []).forEach((photo) => {
      if (photo && photo.key) deleteUploadedImage(photo.key).catch(() => {});
    });
  },
  async syncSelection() {
    let location = app.globalData.joinedCommunity || wx.getStorageSync('joinedCommunity');
    if (!location) {
      try {
        const token = await ensureLogin();
        if (token) {
          const settings = await request('/users/me/settings', { silent: true });
          location = settings.joinedCommunity || null;
          app.setJoinedCommunity(location);
        }
      } catch (_error) { }
    }
    if (location && this.selectionSource !== 'manual') {
      this.selectionSource = 'joined';
      this.setData({ selection: { mode: 'selected', location } });
      return;
    }
    if (!location && this.selectionSource === 'joined') {
      this.selectionSource = '';
      this.setData({ selection: { mode: 'all', location: null } });
      return;
    }
    if (!this.data.selection) this.setData({ selection: { mode: 'all', location: null } });
  },
  async chooseCommunity() {
    if (this.data.selectingCommunity || this.data.submitting) return;
    this.setData({ selectingCommunity: true });
    try {
      const location = await chooseCommunityLocation();
      this.selectionSource = 'manual';
      this.setData({ selection: { mode: 'selected', location } });
    } catch (error) {
      if (error && error.code === 'PRIVACY_DENIED') wx.showToast({ title: '同意位置隐私授权后，才能使用地图选点', icon: 'none' });
      else if (!isLocationCancel(error)) wx.showToast({ title: '无法打开地图，请检查微信的位置权限', icon: 'none' });
    } finally {
      if (this.data.selectingCommunity) this.setData({ selectingCommunity: false });
    }
  },
  selectType(event) {
    const type = String(event.currentTarget.dataset.code || '');
    if (this.data.postCategories.some((item) => item.code === type)) this.setData({ postType: type });
  },
  input(event) {
    const field = event.currentTarget.dataset.field;
    if (field === 'title' || field === 'content') this.setData({ [field]: event.detail.value });
  },
  pickImages() {
    if (this.data.uploading || this.data.submitting) return;
    const remaining = 9 - this.data.photos.length;
    if (remaining <= 0) return wx.showToast({ title: '最多添加 9 张图片', icon: 'none' });
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: async (result) => {
        const files = result.tempFiles || [];
        if (!files.length) return;
        let token;
        try { token = await ensureLogin(); }
        catch (_error) {
          if (!this.pageUnloading) wx.showToast({ title: '登录状态确认失败，请重试', icon: 'none' });
          return;
        }
        if (this.pageUnloading) return;
        if (!token) return wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
        this.setData({ uploading: true, uploadProgress: '准备上传 ' + files.length + ' 张图片' });
        let failed = 0;
        for (let index = 0; index < files.length; index += 1) {
          if (this.pageUnloading) break;
          const file = files[index];
          this.setData({ uploadProgress: '正在上传第 ' + (index + 1) + ' / ' + files.length + ' 张' });
          try {
            const uploaded = await uploadImage(file, 'community-post');
            if (this.pageUnloading) {
              await deleteUploadedImage(uploaded.key).catch(() => {});
              continue;
            }
            this.setData({ photos: this.data.photos.concat({ key: uploaded.key, localPath: file.tempFilePath }) });
          } catch (_error) { failed += 1; }
        }
        if (this.pageUnloading) return;
        this.setData({ uploading: false, uploadProgress: '' });
        if (failed) wx.showToast({ title: failed === files.length ? '图片上传失败，请重试' : failed + ' 张图片上传失败', icon: 'none' });
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.indexOf('cancel') >= 0) return;
        wx.showToast({ title: '无法选择图片，请重试', icon: 'none' });
      }
    });
  },
  removeImage(event) {
    if (this.data.uploading || this.data.submitting) return;
    const index = Number(event.currentTarget.dataset.index);
    const photos = this.data.photos.slice();
    const [photo] = photos.splice(index, 1);
    if (!photo) return;
    this.setData({ photos });
    deleteUploadedImage(photo.key).catch(() => wx.showToast({ title: '图片已移除，云端清理稍后重试', icon: 'none' }));
  },
  previewPhoto(event) {
    const photo = this.data.photos[Number(event.currentTarget.dataset.index)];
    if (!photo) return;
    wx.previewImage({ current: photo.localPath, urls: this.data.photos.map((item) => item.localPath) });
  },
  async submit() {
    if (this.data.submitting || this.data.uploading) return;
    const selection = this.data.selection;
    const location = selection && selection.mode === 'selected' && selection.location;
    const title = String(this.data.title || '').trim();
    const content = String(this.data.content || '').trim();
    if (!location) {
      return wx.showToast({ title: '请先选择发布小区', icon: 'none' });
    }
    if (!title) return wx.showToast({ title: '请填写帖子标题', icon: 'none' });
    if (!content) return wx.showToast({ title: '请补充帖子内容', icon: 'none' });
    if (!this.data.postType) return wx.showToast({ title: '请选择帖子分类', icon: 'none' });
    this.setData({ submitting: true });
    try {
      const token = await ensureLogin();
      if (!token) return wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
      await request('/community/posts', { method: 'POST', data: { postType: this.data.postType, community: location, title, content, images: this.data.photos.map((photo) => photo.key) } });
      this.setData({ photos: [] });
      wx.showModal({ title: '已提交审核', content: '审核通过后，小区邻居就能看到这条帖子。', showCancel: false, success: () => wx.navigateBack({ delta: 1 }) });
    } catch (_error) {
    } finally { this.setData({ submitting: false }); }
  }
});

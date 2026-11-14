const app = getApp();
const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { uploadImage } = require('../../utils/upload');
const { readDraft, writeDraft, clearDraft, removeSavedPhoto } = require('../../utils/local-state');

Page({
  data: {
    selection: null,
    categories: [],
    categoryId: '',
    categoryLabel: '',
    categoryLoading: true,
    categoryError: false,
    title: '',
    titleCount: 0,
    description: '',
    descriptionCount: 0,
    price: '',
    conditionLabel: '',
    contactType: 'none',
    contactValue: '',
    photos: [],
    uploading: false,
    uploadProgress: '',
    selectingCommunity: false,
    submitting: false,
    hasDraft: false,
    draftSavedAt: '',
    fieldErrors: {}
  },

  onLoad() { this.restoreDraft(); this.loadCategories(); },

  onShow() {
    if (this.data.hasDraft && !readDraft()) this.resetDraft();
    const selection = this.publishSelection || (this.data.hasDraft && this.data.selection && this.data.selection.mode === 'selected' ? this.data.selection : null) || app.globalData.communitySelection || wx.getStorageSync('communitySelection') || { mode: 'all', location: null };
    this.setData({ selection });
  },

  restoreDraft() {
    const draft = readDraft();
    if (!draft) return;
    const selection = draft.selection || app.globalData.communitySelection || { mode: 'all', location: null };
    this.publishSelection = selection;
    this.setData(Object.assign({}, draft.fields || {}, {
      selection,
      photos: Array.isArray(draft.photos) ? draft.photos.map((photo) => Object.assign({}, photo, { needsRenewal: true })) : [],
      hasDraft: true,
      draftSavedAt: draft.savedAt ? '已保存草稿' : '草稿已恢复'
    }));
  },

  resetDraft() {
    this.publishSelection = null;
    const selection = app.globalData.communitySelection || { mode: 'all', location: null };
    this.setData({
      selection, categoryId: '', categoryLabel: '', title: '', titleCount: 0,
      description: '', descriptionCount: 0, price: '', conditionLabel: '',
      contactType: 'none', contactValue: '', photos: [], fieldErrors: {},
      uploading: false, uploadProgress: '', hasDraft: false, draftSavedAt: ''
    });
  },

  draftPayload() {
    return {
      selection: this.publishSelection || this.data.selection,
      fields: {
        categoryId: this.data.categoryId, categoryLabel: this.data.categoryLabel,
        title: this.data.title, titleCount: this.data.titleCount,
        description: this.data.description, descriptionCount: this.data.descriptionCount,
        price: this.data.price, conditionLabel: this.data.conditionLabel,
        contactType: this.data.contactType, contactValue: this.data.contactValue
      },
      photos: this.data.photos
    };
  },

  hasDraftContent() {
    return Boolean(this.data.title || this.data.description || this.data.price || this.data.photos.length || this.data.categoryId || this.data.contactValue);
  },

  scheduleDraftSave() {
    if (this.data.submitting || !this.hasDraftContent()) return;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.saveDraft(true), 650);
  },

  saveDraft(silent) {
    if (!this.hasDraftContent()) {
      if (!silent) wx.showToast({ title: '填写内容后即可保存草稿', icon: 'none' });
      return;
    }
    writeDraft(this.draftPayload());
    this.setData({ hasDraft: true, draftSavedAt: '草稿已保存' });
    if (!silent) wx.showToast({ title: '草稿已保存', icon: 'success' });
  },

  onHide() {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = null;
    this.saveDraft(true);
  },

  onUnload() {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = null;
    this.saveDraft(true);
  },

  async loadCategories() {
    this.setData({ categoryLoading: true, categoryError: false });
    try {
      const categories = await request('/categories', { silent: true });
      this.setData({ categories, categoryLoading: false });
    } catch (_error) {
      this.setData({ categoryLoading: false, categoryError: true });
    }
  },

  async openCommunity() {
    if (this.data.selectingCommunity || this.data.submitting) return;
    this.setData({ selectingCommunity: true });
    if (wx.requirePrivacyAuthorize) {
      try {
        await new Promise((resolve, reject) => wx.requirePrivacyAuthorize({ success: resolve, fail: reject }));
      } catch (_error) {
        this.setData({ selectingCommunity: false });
        wx.showToast({ title: '同意位置隐私授权后，才能使用地图选点', icon: 'none' });
        return;
      }
    }
    wx.chooseLocation({
      success: (location) => {
        this.publishSelection = { mode: 'selected', location };
        this.setData({ selection: this.publishSelection, selectingCommunity: false, 'fieldErrors.community': '' });
        this.scheduleDraftSave();
      },
      fail: (error) => {
        this.setData({ selectingCommunity: false });
        if (error && error.errMsg && error.errMsg.indexOf('cancel') >= 0) return;
        wx.showToast({ title: '无法打开地图，请检查微信的位置权限', icon: 'none' });
      }
    });
  },

  input(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    const update = { [field]: value };
    if (field === 'title') update.titleCount = value.length;
    if (field === 'description') update.descriptionCount = value.length;
    if (this.data.fieldErrors[field]) update['fieldErrors.' + field] = this.fieldMessage(field, value);
    this.setData(update);
    this.scheduleDraftSave();
  },

  validateField(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ ['fieldErrors.' + field]: this.fieldMessage(field) });
  },

  fieldMessage(field, inputValue) {
    const value = inputValue === undefined ? this.data[field] : inputValue;
    if (field === 'community') {
      const selection = this.publishSelection || this.data.selection || app.globalData.communitySelection;
      return selection && selection.mode === 'selected' && selection.location ? '' : '请先选择物品归属小区';
    }
    if (field === 'title') return String(value || '').trim() ? '' : '请填写物品标题';
    if (field === 'description') return String(value || '').trim() ? '' : '请补充物品情况和交易说明';
    if (field === 'price') return value !== '' && /^\d{1,8}(\.\d{1,2})?$/.test(String(value).trim()) ? '' : '请输入有效价格，最多两位小数';
    if (field === 'category') return this.data.categoryId ? '' : '请选择物品分类';
    if (field === 'photos') return this.data.photos.length ? '' : '请至少添加一张商品图片';
    if (field === 'contactValue' && this.data.contactType !== 'none') return String(value || '').trim() ? '' : '请填写愿意公开的联系方式';
    return '';
  },

  selectCategory(event) {
    const category = this.data.categories[Number(event.detail.value)];
    this.setData({
      categoryId: category ? category.id : '',
      categoryLabel: category ? category.name : '',
      'fieldErrors.category': ''
    });
    this.scheduleDraftSave();
  },

  selectContact(event) {
    const contactType = event.detail.value;
    this.setData({
      contactType,
      contactValue: contactType === 'none' ? '' : this.data.contactValue,
      'fieldErrors.contactValue': ''
    });
    this.scheduleDraftSave();
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
        this.setData({ uploading: true, uploadProgress: '准备上传 ' + files.length + ' 张图片' });
        let failed = 0;
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          this.setData({ uploadProgress: '正在上传第 ' + (index + 1) + ' / ' + files.length + ' 张' });
          try {
            const resultItem = await uploadImage(file);
            const localPath = await new Promise((resolve) => wx.saveFile({ tempFilePath: file.tempFilePath, success: (saved) => resolve(saved.savedFilePath), fail: () => resolve(file.tempFilePath) }));
            this.setData({ photos: this.data.photos.concat({ key: resultItem.key, localPath }) });
          } catch (_error) { failed += 1; }
        }
        this.setData({ uploading: false, uploadProgress: '', 'fieldErrors.photos': this.data.photos.length ? '' : this.data.fieldErrors.photos });
        this.scheduleDraftSave();
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
    const removedPhoto = photos.splice(index, 1)[0];
    removeSavedPhoto(removedPhoto);
    this.setData({ photos, 'fieldErrors.photos': photos.length ? '' : this.data.fieldErrors.photos });
    this.scheduleDraftSave();
  },

  previewPhoto(event) {
    const photos = this.data.photos;
    const photo = photos[Number(event.currentTarget.dataset.index)];
    if (!photo) return;
    wx.previewImage({ current: photo.localPath, urls: photos.map((item) => item.localPath) });
  },

  async prepareDraftPhotos() {
    const photos = this.data.photos.slice();
    if (!photos.some((photo) => photo.needsRenewal)) return photos;
    this.setData({ uploading: true, uploadProgress: '正在恢复草稿图片…' });
    try {
      for (let index = 0; index < photos.length; index += 1) {
        if (!photos[index].needsRenewal) continue;
        if (!photos[index].localPath) throw new Error('草稿图片已失效');
        this.setData({ uploadProgress: '恢复图片 ' + (index + 1) + ' / ' + photos.length });
        const uploaded = await uploadImage({ tempFilePath: photos[index].localPath });
        photos[index] = Object.assign({}, photos[index], { key: uploaded.key, needsRenewal: false });
      }
      this.setData({ photos, uploading: false, uploadProgress: '' });
      writeDraft(this.draftPayload());
      return photos;
    } catch (error) {
      this.setData({ uploading: false, uploadProgress: '' });
      throw error;
    }
  },

  validate() {
    const selection = this.publishSelection || this.data.selection || app.globalData.communitySelection;
    const errors = {
      community: this.fieldMessage('community'),
      title: this.fieldMessage('title'),
      description: this.fieldMessage('description'),
      price: this.fieldMessage('price'),
      category: this.fieldMessage('category'),
      photos: this.fieldMessage('photos'),
      contactValue: this.fieldMessage('contactValue')
    };
    this.setData({ fieldErrors: errors });
    const firstError = errors.community || errors.title || errors.description || errors.price || errors.category || errors.photos || errors.contactValue;
    if (firstError) {
      wx.showToast({ title: firstError, icon: 'none' });
      return false;
    }
    return selection;
  },

  async submit() {
    if (this.data.submitting || this.data.uploading) return;
    const selection = this.validate();
    if (!selection) return;
    this.setData({ submitting: true });
    try {
      await ensureLogin();
      const photos = await this.prepareDraftPhotos();
      await request('/listings', { method: 'POST', data: {
        community: selection.location,
        categoryId: this.data.categoryId,
        title: this.data.title.trim(),
        description: this.data.description.trim(),
        price: Number(this.data.price),
        conditionLabel: this.data.conditionLabel.trim(),
        contactType: this.data.contactType,
        contactValue: this.data.contactValue.trim(),
        images: photos.map((photo) => photo.key)
      } });
      clearDraft();
      this.setData({
        title: '', titleCount: 0, description: '', descriptionCount: 0, price: '', conditionLabel: '',
        contactType: 'none', contactValue: '', photos: [], fieldErrors: {}, hasDraft: false, draftSavedAt: ''
      });
      wx.showModal({
        title: '已提交审核',
        content: '审核通过后，附近的邻居就能看到这件好物。',
        showCancel: false,
        success: () => {
          wx.setStorageSync('meActiveMode', 'listings');
          wx.switchTab({ url: '/pages/me/me' });
        }
      });
    } catch (error) {
      if (error && error.message === '草稿图片已失效') wx.showToast({ title: '有图片已失效，请删除后重新添加', icon: 'none' });
      else if (this.data.photos.some((photo) => photo.needsRenewal)) wx.showToast({ title: '草稿图片恢复失败，请检查网络后重试', icon: 'none' });
    } finally { this.setData({ submitting: false }); }
  }
});

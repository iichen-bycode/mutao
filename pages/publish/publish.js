const app = getApp();
const { request } = require('../../utils/request');
const { ensureLogin } = require('../../utils/auth');
const { uploadImage, deleteUploadedImage } = require('../../utils/upload');
const { readDraft, writeDraft, clearDraft, removeSavedPhoto } = require('../../utils/local-state');
const { syncCustomTabBar } = require('../../utils/tab-bar');
const { chooseCommunityLocation, isLocationCancel } = require('../../utils/community-picker');
const config = require('../../utils/config');

const DEFAULT_MAX_IMAGES = 5;
const MAX_IMAGES_PER_PICK = 9;
const configuredMaxImages = Number(config.maxListingImages);
const maxListingImages = Number.isInteger(configuredMaxImages) && configuredMaxImages > 0
  ? configuredMaxImages
  : DEFAULT_MAX_IMAGES;

Page({
  data: {
    maxImages: maxListingImages,
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
    originalPrice: '',
    conditionLabel: '',
    deliveryType: 'pickup',
    contactType: 'none',
    contactValue: '',
    photos: [],
    pendingPhotoDeletes: [],
    uploading: false,
    deletingPhotos: false,
    uploadProgress: '',
    selectingCommunity: false,
    submitting: false,
    hasDraft: false,
    fieldErrors: {}
  },

  onLoad() {
    const draft = readDraft();
    if (draft && (!draft.fields || !draft.fields.publishType || draft.fields.publishType === 'listing')) this.restoreDraft();
    this.loadCategories();
  },

  onShow() {
    syncCustomTabBar(this);
    if (this.data.hasDraft && !readDraft()) this.resetDraft();
    const selection = this.listingBrowseSelection();
    this.setData({ selection });
    if (this.data.pendingPhotoDeletes.length) this.cleanupPendingPhotoDeletes();
  },

  listingBrowseSelection() {
    return this.publishSelection || app.globalData.listingBrowseSelection || wx.getStorageSync('listingBrowseSelection') || { mode: 'all', location: null };
  },

  restoreDraft() {
    const draft = readDraft();
    if (!draft) return;
    const fields = Object.assign({}, draft.fields || {});
    if (fields.publishType && fields.publishType !== 'listing') return;
    delete fields.publishType;
    delete fields.communityPostType;
    const selection = draft.selection || app.globalData.listingBrowseSelection || { mode: 'all', location: null };
    const pendingPhotoDeletes = Array.isArray(draft.pendingPhotoDeletes) ? Array.from(new Set(draft.pendingPhotoDeletes.filter((key) => typeof key === 'string' && key))) : [];
    const pendingDeleteSet = new Set(pendingPhotoDeletes);
    const photos = Array.isArray(draft.photos) ? draft.photos.filter((photo) => !pendingDeleteSet.has(photo.key)).map((photo) => Object.assign({}, photo, { needsRenewal: true })) : [];
    if (Array.isArray(draft.photos)) draft.photos.filter((photo) => pendingDeleteSet.has(photo.key)).forEach(removeSavedPhoto);
    this.publishSelection = selection;
    this.setData(Object.assign({}, fields, {
      selection,
      photos,
      pendingPhotoDeletes,
      hasDraft: true
    }));
  },

  resetDraft() {
    this.publishSelection = null;
    const selection = app.globalData.listingBrowseSelection || wx.getStorageSync('listingBrowseSelection') || { mode: 'all', location: null };
    this.setData({
      selection, categoryId: '', categoryLabel: '', title: '', titleCount: 0,
      description: '', descriptionCount: 0, price: '', originalPrice: '', conditionLabel: '', deliveryType: 'pickup',
      contactType: 'none', contactValue: '', photos: [], pendingPhotoDeletes: [], fieldErrors: {},
      uploading: false, deletingPhotos: false, uploadProgress: '', hasDraft: false
    });
  },

  draftPayload() {
    return {
      selection: this.publishSelection || this.data.selection,
      fields: {
        categoryId: this.data.categoryId, categoryLabel: this.data.categoryLabel,
        title: this.data.title, titleCount: this.data.titleCount,
        description: this.data.description, descriptionCount: this.data.descriptionCount,
        price: this.data.price, originalPrice: this.data.originalPrice, conditionLabel: this.data.conditionLabel, deliveryType: this.data.deliveryType,
        contactType: this.data.contactType, contactValue: this.data.contactValue
      },
      photos: this.data.photos,
      pendingPhotoDeletes: this.data.pendingPhotoDeletes || []
    };
  },

  hasDraftContent(draft) {
    const snapshot = draft || this.draftPayload();
    const fields = snapshot.fields || {};
    const selection = snapshot.selection;
    const hasSelectedCommunity = Boolean(selection && selection.mode === 'selected' && selection.location);
    return Boolean(
      hasSelectedCommunity || fields.title || fields.description || fields.price || fields.originalPrice ||
      fields.categoryId || fields.conditionLabel || (fields.deliveryType && fields.deliveryType !== 'pickup') ||
      (fields.contactType && fields.contactType !== 'none') || fields.contactValue ||
      (snapshot.photos || []).length || (snapshot.pendingPhotoDeletes || []).length
    );
  },

  persistDraftSnapshot(draft) {
    if (!this.hasDraftContent(draft)) {
      clearDraft();
      this.setData({ hasDraft: false });
      return false;
    }
    writeDraft(draft);
    this.setData({ hasDraft: true });
    return true;
  },

  scheduleDraftSave() {
    if (this.data.submitting) return;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.saveDraft(), 650);
  },

  saveDraft() {
    if (this.data.submitting) return;
    this.persistDraftSnapshot(this.draftPayload());
  },

  onHide() {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = null;
    this.saveDraft();
  },

  onUnload() {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = null;
    this.saveDraft();
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
    try {
      const location = await chooseCommunityLocation();
      this.publishSelection = { mode: 'selected', location };
      this.setData({ selection: this.publishSelection, 'fieldErrors.community': '' });
      this.scheduleDraftSave();
    } catch (error) {
      if (error && error.code === 'PRIVACY_DENIED') wx.showToast({ title: '同意位置隐私授权后，才能使用地图选点', icon: 'none' });
      else if (!isLocationCancel(error)) wx.showToast({ title: '无法打开地图，请检查微信的位置权限', icon: 'none' });
    } finally {
      if (this.data.selectingCommunity) this.setData({ selectingCommunity: false });
    }
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
      const selection = this.listingBrowseSelection();
      if (selection && selection.mode === 'selected' && selection.location) return '';
      return '请先选择物品归属小区';
    }
    if (field === 'title') return String(value || '').trim() ? '' : '请填写物品标题';
    if (field === 'description') return String(value || '').trim() ? '' : '请补充物品情况和交易说明';
    if (field === 'price') return value !== '' && /^\d{1,8}(\.\d{1,2})?$/.test(String(value).trim()) ? '' : '请输入有效价格，最多两位小数';
    if (field === 'originalPrice') {
      if (value === '' || value === undefined || value === null) return '';
      if (!/^\d{1,8}(\.\d{1,2})?$/.test(String(value).trim())) return '请输入有效原价，最多两位小数';
      return Number(value) >= Number(this.data.price) ? '' : '原价不能低于转让价格';
    }
    if (field === 'category') return this.data.categoryId ? '' : '请选择物品分类';
    if (field === 'photos') {
      if (this.data.photos.length > this.data.maxImages) return '最多添加 ' + this.data.maxImages + ' 张图片，请移除多余图片';
      return this.data.photos.length ? '' : '请至少添加一张商品图片';
    }
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

  selectDelivery(event) {
    this.setData({ deliveryType: String(event.currentTarget.dataset.type || 'pickup') });
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
    if (this.data.uploading || this.data.deletingPhotos || this.data.submitting) return;
    const remaining = this.data.maxImages - this.data.photos.length;
    if (remaining <= 0) return wx.showToast({ title: '最多添加 ' + this.data.maxImages + ' 张图片', icon: 'none' });
    wx.chooseMedia({
      count: Math.min(remaining, MAX_IMAGES_PER_PICK),
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
            const resultItem = await uploadImage(file, 'listing');
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
    if (this.data.uploading || this.data.deletingPhotos || this.data.submitting) return;
    const index = Number(event.currentTarget.dataset.index);
    const photos = this.data.photos.slice();
    const removedPhoto = photos.splice(index, 1)[0];
    if (!removedPhoto) return;
    const pendingPhotoDeletes = removedPhoto.key
      ? Array.from(new Set((this.data.pendingPhotoDeletes || []).concat(removedPhoto.key)))
      : (this.data.pendingPhotoDeletes || []).slice();
    const draft = this.draftPayload();
    draft.photos = photos;
    draft.pendingPhotoDeletes = pendingPhotoDeletes;
    const photoError = photos.length > this.data.maxImages
      ? '最多添加 ' + this.data.maxImages + ' 张图片，请移除多余图片'
      : (photos.length ? '' : this.data.fieldErrors.photos);
    this.setData({ photos, pendingPhotoDeletes, 'fieldErrors.photos': photoError });
    this.persistDraftSnapshot(draft);
    removeSavedPhoto(removedPhoto);
    if (removedPhoto.key) this.cleanupPendingPhotoDeletes();
    else this.scheduleDraftSave();
  },

  async cleanupPendingPhotoDeletes() {
    if (this.photoDeletePromise) return this.photoDeletePromise;
    const keys = (this.data.pendingPhotoDeletes || []).slice();
    if (!keys.length || this.data.submitting) return true;
    this.setData({ deletingPhotos: true });
    this.photoDeletePromise = (async () => {
      let failed = false;
      for (const key of keys) {
        if (!(this.data.pendingPhotoDeletes || []).includes(key)) continue;
        try {
          await deleteUploadedImage(key);
          const pendingPhotoDeletes = this.data.pendingPhotoDeletes.filter((pendingKey) => pendingKey !== key);
          this.setData({ pendingPhotoDeletes });
          const draft = this.draftPayload();
          draft.pendingPhotoDeletes = pendingPhotoDeletes;
          this.persistDraftSnapshot(draft);
        } catch (error) {
          if (error && error.message === '图片不存在') {
            // A stale tombstone from an older account/session is terminal. Drop it
            // so it does not trigger a failing delete request every time the page opens.
            const pendingPhotoDeletes = this.data.pendingPhotoDeletes.filter((pendingKey) => pendingKey !== key);
            this.setData({ pendingPhotoDeletes });
            const draft = this.draftPayload();
            draft.pendingPhotoDeletes = pendingPhotoDeletes;
            this.persistDraftSnapshot(draft);
          } else {
            failed = true;
          }
        }
      }
      if (failed) {
        const draft = this.draftPayload();
        draft.pendingPhotoDeletes = this.data.pendingPhotoDeletes.slice();
        this.persistDraftSnapshot(draft);
        wx.showToast({ title: '图片已移除，远程清理失败，稍后会重试', icon: 'none' });
        return false;
      }
      return true;
    })().finally(() => {
      this.photoDeletePromise = null;
      this.setData({ deletingPhotos: false });
    });
    return this.photoDeletePromise;
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
        const uploaded = await uploadImage({ tempFilePath: photos[index].localPath }, 'listing');
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
    const selection = this.listingBrowseSelection();
    const errors = {
      community: this.fieldMessage('community'),
      title: this.fieldMessage('title'),
      description: this.fieldMessage('description'),
      price: this.fieldMessage('price'),
      originalPrice: this.fieldMessage('originalPrice'),
      category: this.fieldMessage('category'),
      photos: this.fieldMessage('photos'),
      contactValue: this.fieldMessage('contactValue')
    };
    this.setData({ fieldErrors: errors });
    const firstError = errors.community || errors.title || errors.description || errors.price || errors.originalPrice || errors.category || errors.photos || errors.contactValue;
    if (firstError) {
      wx.showToast({ title: firstError, icon: 'none' });
      return false;
    }
    return selection;
  },

  async submit() {
    if (this.data.submitting || this.data.uploading || this.data.deletingPhotos) return;
    if (this.data.pendingPhotoDeletes.length && !(await this.cleanupPendingPhotoDeletes())) return;
    const selection = this.validate();
    if (!selection) return;
    this.setData({ submitting: true });
    try {
      const token = await ensureLogin();
      if (!token) {
        wx.showToast({ title: '请先在“我的”页面重新登录', icon: 'none' });
        return;
      }
      const photos = await this.prepareDraftPhotos();
      const data = {
        community: selection.location,
        categoryId: this.data.categoryId,
        title: this.data.title.trim(),
        description: this.data.description.trim(),
        price: Number(this.data.price),
        originalPrice: this.data.originalPrice === '' ? null : Number(this.data.originalPrice),
        conditionLabel: this.data.conditionLabel.trim(),
        deliveryType: this.data.deliveryType,
        contactType: this.data.contactType,
        contactValue: this.data.contactValue.trim(),
        images: photos.map((photo) => photo.key)
      };
      await request('/listings', { method: 'POST', data });
      clearDraft();
      this.setData({
        title: '', titleCount: 0, description: '', descriptionCount: 0, price: '', originalPrice: '', conditionLabel: '', deliveryType: 'pickup',
        contactType: 'none', contactValue: '', photos: [], fieldErrors: {}, hasDraft: false
      });
      wx.showModal({
        title: '已提交审核',
        content: '审核通过后，这件闲置会出现在首页物品信息流中。',
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

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: 'pages/index/index', text: '首页', icon: 'home' },
      { pagePath: 'pages/community-feed/community-feed', text: '社区', icon: 'community' },
      { pagePath: 'pages/publish/publish', text: '发布', icon: 'publish' },
      { pagePath: 'pages/conversations/conversations', text: '消息', icon: 'message' },
      { pagePath: 'pages/me/me', text: '我的', icon: 'me' }
    ]
  },
  pageLifetimes: {
    show() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const route = String(current && current.route || '').replace(/^\/+/, '');
      const selected = this.data.list.findIndex((item) => item.pagePath === route);
      if (selected >= 0 && selected !== this.data.selected) this.setData({ selected });
    }
  },
  methods: {
    createCommunityPost() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      if (current && current.route === 'pages/community-feed/community-feed') current.returnFromPost = true;
      wx.navigateTo({ url: '/pages/community-post-create/community-post-create' });
    },

    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index);
      const target = this.data.list[index];
      if (!target || this.switching) return;

      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const currentRoute = String(current && current.route || '').replace(/^\/+/, '');
      if (currentRoute === target.pagePath) {
        this.setData({ selected: index });
        return;
      }

      this.switching = true;
      this.setData({ selected: index });
      wx.switchTab({
        url: '/' + target.pagePath,
        fail: () => {
          const visiblePages = getCurrentPages();
          const visible = visiblePages[visiblePages.length - 1];
          const visibleRoute = String(visible && visible.route || '').replace(/^\/+/, '');
          const visibleIndex = this.data.list.findIndex((item) => item.pagePath === visibleRoute);
          this.setData({ selected: visibleIndex >= 0 ? visibleIndex : 0 });
          wx.showToast({ title: '页面切换失败，请重试', icon: 'none' });
        },
        complete: () => { this.switching = false; }
      });
    }
  }
});

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
      const route = current && current.route;
      const selected = this.data.list.findIndex((item) => item.pagePath === route);
      if (selected >= 0 && selected !== this.data.selected) this.setData({ selected });
    }
  },
  methods: {
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index);
      const target = this.data.list[index];
      if (!target || index === this.data.selected) return;
      wx.switchTab({ url: '/' + target.pagePath });
    }
  }
});

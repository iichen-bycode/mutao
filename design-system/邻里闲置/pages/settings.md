# 设置

- 使用五个分组：账号设置、消息通知、隐私设置、通用、帮助与法律；暖色背景、白色圆角列表卡片、柔和珊瑚色开关。
- 账号区显示微信手机号授权绑定状态；不支持独立密码时，说明当前能力，不伪造成功状态。
- Provide an account-level community membership row that lets the user join, change, or leave a community. Persist membership with the account; keep it separate from the home listing filter and community-feed browsing filter.
- 通知和隐私选项、主题模式保存到当前用户的服务端设置；失败时回滚开关并提示重试。
- 绑定或修改手机号时在弹窗输入11位号码，由 API 校验格式并保存到当前账号；设置页只显示中间四位脱敏后的号码。
- 深色模式提供跟随系统、浅色和深色三个选项。清缓存只删除本机可清理的临时文件，保留发布草稿、登录状态和浏览记录。
- 清空浏览记录前确认，并标明这是本机数据。检查更新接入微信版本管理器。
- 帮助、协议和隐私说明可查看；联系客服使用微信客服入口，绑定手机号使用输入框填写并保存到账号。退出登录需清除本地会话并提供重新登录入口。
- 加载账号设置时显示加载状态；失败时提供重试。

# bilibili-qx-rules

Quantumult X 的 bilibili 去广告规则，Fork 自 [app2smile/rules](https://github.com/app2smile/rules)，**修复了开启后评论区无法加载的问题**。

## 问题背景

原版规则会重写 gRPC 接口 `bilibili.app.viewunite.v1.View/View`（用于去掉播放页「UP主推荐」位的广告）。

但评论区走的是 gRPC 接口 `bilibili.main.community.reply.v1.Reply/MainList`，与 `View/View` 同域名，且在点开视频页的瞬间**并发发出、复用同一条 HTTP/2 连接**。

而处理它的 `bilibili-proto.js` 内嵌了 protobuf-ts + pako + text-decoder，必须把整个响应体缓冲下来用 JS 解析、改写、再重新编码。一旦解析超时或报错，代理会重置整条连接，挂在同一条连接上的评论流被一并杀掉，表现就是**评论区一直转圈**。

上游 [issue #28](https://github.com/app2smile/rules/issues/28) 有同样的报告，作者的结论是「此连接中断重连了」；[issue #210](https://github.com/app2smile/rules/issues/210) 另有人反馈该脚本内存占用过高。

## 订阅地址

### 推荐档 `module/bilibili-qx.conf`

移除 `View/View` 重写，其余全部保留。

```
https://raw.githubusercontent.com/chao302/bilibili-qx-rules/main/module/bilibili-qx.conf
```

| | |
|---|---|
| 保留 | 开屏广告、推荐页信息流广告、**「刷视频」竖屏广告**、底栏(发布/会员购)、右上角游戏中心、动态页广告 |
| 失去 | 视频播放页「UP主推荐」位的广告 |

### 保险档 `module/bilibili-qx-safe.conf`

推荐档仍偶发评论区失败时改用。移除所有 gRPC 重写，MITM 范围收窄到 `app.bilibili.com`。

```
https://raw.githubusercontent.com/chao302/bilibili-qx-rules/main/module/bilibili-qx-safe.conf
```

| | |
|---|---|
| 保留 | 开屏广告、推荐页信息流广告、**「刷视频」竖屏广告**、底栏(发布/会员购)、右上角游戏中心 |
| 失去 | 播放页「UP主推荐」广告、动态页广告 |

## 「刷视频」竖屏广告过滤

`js/bilibili-json.js` 增加了对 `app.bilibili.com/x/v2/feed/index/story` 的处理——这是「刷视频」沉浸式竖屏 feed 的接口。

判定逻辑：剔除带 `ad_info` 字段的条目，以及 `card_goto` 为 `vertical_ad_av`（视频广告）、`vertical_ad_live`（直播广告）、`vertical_ad_picture`（图片广告）的条目；保留下来的条目再清掉 `story_cart_icon`（购物车角标）、`free_flow_toast`（免流提示）、`image_infos`、`course_info`（课程推广）、`game_info`（游戏推广）。

判定字段与 [fmz200/wool_scripts](https://github.com/fmz200/wool_scripts)、[kokoryh/Sparkle](https://github.com/kokoryh/Sparkle) 两个仍在活跃维护的项目交叉核对一致。

**这条是纯 JSON 接口、非 gRPC**，因此不经过 protobuf 脚本，对评论区加载没有任何影响——推荐档和保险档都包含此过滤。

## 使用方式

在 Quantumult X 配置的 `[rewrite_remote]` 段加入上面任意一条链接，然后重启网络扩展，并杀掉 B 站后台重新打开。

```
[rewrite_remote]
https://raw.githubusercontent.com/chao302/bilibili-qx-rules/main/module/bilibili-qx.conf, tag=bilibili去广告, update-interval=172800, opt-parser=false, enabled=true
```

## 关于内置脚本

`js/` 下的两个脚本是从上游仓库固化过来的，**不再引用上游 raw 链接**。原因是上游已停更约两年（模块本体最后更新 2023-08-13、`bilibili-proto.js` 2024-11-02、`bilibili-json.js` 2023-10-22），继续外链存在被改动或删除而连带失效的风险。

代价是不会自动获得上游后续修复。如需同步上游改动：

```bash
git remote add upstream https://github.com/app2smile/rules.git
git fetch upstream master
git checkout upstream/master -- js/bilibili-json.js js/bilibili-proto.js
```

## 已知限制

- Quantumult X 的 `[mitm] hostname` **不支持** `-` 前缀排除语法（那是 Surge 的写法），官方只提供 `skip_src_ip` / `skip_dst_ip`。因此收窄 MITM 范围只能像保险档那样直接删减 hostname 列表。
- B 站客户端的 protobuf 定义持续变动，`bilibili-proto.js` 存在与新版客户端错位的可能。若动态页出现异常，直接换用保险档。

## 致谢

规则与脚本原作者 [@app2smile](https://github.com/app2smile)。

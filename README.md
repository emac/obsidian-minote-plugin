# Obsidian Plugin: 小米笔记同步插件

[![GitHub license](https://badgen.net/github/license/Naereen/Strapdown.js)](https://github.com/emac/obsidian-minote-plugin/blob/master/LICENSE)
[![Github all releases](https://img.shields.io/github/downloads/emac/obsidian-minote-plugin/total.svg)](https://GitHub.com/emac/obsidian-minote-plugin/releases)
[![GitLab latest release](https://badgen.net/github/release/emac/obsidian-minote-plugin/all)](https://github.com/emac/obsidian-minote-plugin/releases)

Obsidian 小米笔记同步插件是一个社区插件，用来将[小米笔记](https://i.mi.com/note/h5#/)转换为 Markdown 格式保存到 Obsidian 指定的文件夹中。首次使用，如果笔记数量较多，更新会比较慢，后面再去更新的时候只会增量更新有变化的笔记，一般速度很快。

## 更新历史
https://github.com/emac/obsidian-minote-plugin/releases

## 功能
- 笔记以ID命名：使用笔记ID作为文件名，避免标题重命名导致的同步问题
- 文件夹映射为标签：将小米笔记的文件夹结构转换为Obsidian标签，所有笔记存放在同一目录
- 支持多种笔记类型：普通笔记、手写笔记、思维导图
- 富文本格式支持：自动转换斜体、下划线、高亮等格式
- 自动下载附件：下载笔记中的图片和音频，并使用Obsidian嵌入语法
- 保留原始时间戳：同步后的文件保持小米笔记的创建和修改时间
- 增量更新：只同步有变化的笔记，速度快
- 支持强制同步模式：全量覆盖更新所有笔记
- 支持非中国区的小米云服务

## 安装方法
打开 Obsidian 的设置页面，点选左侧`第三方插件`，点击`关闭安全模式`按钮以启用第三方插件，点击社区插件市场的`浏览`按钮，搜索 `minote`，找到 `Minote Sync` 插件，然后安装和启用。也可以直接在 [releases](https://github.com/emac/obsidian-minote-plugin/releases) 页面手动下载最新版本。

## 设置
1. 打开 Obsidian 的设置页面，找到 `Minote Sync` 进入到插件设置页面
2. 点击右侧 `登录` 按钮，在弹出的登录页面扫码登录，登录完成后，会显示个人昵称
3. 注销登录可以清除插件的 Cookie 信息，注销方法和网页版小米云服务一样，右上角点击头像，点击退出
4. 设置笔记保存位置，默认保存到 `/minote` 文件夹，可以修改为其他位置

![](/minote-sync-settings.jpg)

## 使用
⚠️ 本插件是覆盖式更新，请不要在同步的文件里修改内容。

点击左侧 Ribbon 上的小米笔记按钮(![](/cloud-download.png))，或者 `command+P(windows ctrl+P)` 调出 Command Pattle 输入 `Minote` 找到`同步小米笔记`即可同步。

## 已知问题
- 一段时间不使用本插件，Cookie 可能会失效，需要到插件设置页面手动刷新Cookie。
- 偶尔可能会有网络连接问题，重新点击同步即可，已同步的笔记不会再次更新。

## TODO
- [ ] 支持移动端
- [ ] 支持删除同步

## 赞赏
<img src="/wechat-sponsors.jpg" width=30% />

## 免责声明
所有笔记内容均来自小米云服务，用户登录即授权本插件同步用户的笔记内容到本地。

## 感谢
- [Weread Plugin](https://github.com/zhaohongxuan/obsidian-weread-plugin)
- [minote-Obsidian](https://github.com/yulittlemoon/minote-Obsidian)
- [Obsidian Plugin Developer Docs](https://marcus.se.net/obsidian-plugin-docs/)

---

# Obsidian Plugin: Minote Sync Plugin

This community plugin syncs your [Xiaomi notes](https://i.mi.com/note/h5#/) to Obsidian by converting them to Markdown format and saving them in a specified folder. The initial sync might be slow if you have many notes, but subsequent syncs will only update changed notes incrementally.

## Features
- ID-based file naming: Uses note IDs as filenames to avoid sync issues from title changes
- Folders mapped to tags: Converts Xiaomi notes folder structure to Obsidian tags, storing all notes in one directory
- Multiple note types support: Regular notes, handwritten notes, and mind maps
- Rich text format support: Automatically converts italic, underline, highlight, etc.
- Automatic attachment download: Downloads images and audio from notes using Obsidian embed syntax
- Preserves original timestamps: Synced files maintain creation and modification times from Xiaomi notes
- Incremental updates: Only syncs changed notes for faster performance
- Force sync mode: Full overwrite updates for all notes
- Supports Xiaomi Cloud Services in non-Chinese regions

## Installation
Open Obsidian settings, go to `Community plugins` on the left, click the `Turn off safe mode` button to enable third-party plugins. Click the `Browse` button in the Community plugins marketplace, search for `minote`, find `Minote Sync` plugin, then install and enable it. You can also manually download the latest version from the [release](https://github.com/emac/obsidian-minote-plugin/releases) page.

## Settings
1. Open Obsidian settings, find `Minote Sync` in the plugin settings
2. Click the `Login` button and scan the QR code in the popup login page
3. To logout and clear the plugin's Cookie information, follow the same process as the web version of Xiaomi Cloud Service - click the avatar in the top right corner and select logout
4. Set note storage location (default is `/minote` folder)

## Usage
⚠️ This plugin uses overwrite updates. Please don't modify content in synced files.

Click the Xiaomi notes button(![](/cloud-download.png)) in the left Ribbon, or use `command+P(windows ctrl+P)` to open Command Palette and search for `Minote`.

## Known Issues
- Cookie may expire after periods of inactivity, requiring manual refresh in plugin settings
- Occasional network connection issues may occur; simply retry sync (already synced notes won't update again)
## todo lists
- [ ] Support deletion sync
- [ ] Support mind maps
- [ ] Support mobile devices

## Disclaimer
All note content comes from Xiaomi Cloud Services. User login authorizes this plugin to sync notes to local storage.

## Acknowledgments
- [Weread Plugin](https://github.com/zhaohongxuan/obsidian-weread-plugin)
- [minote-Obsidian](https://github.com/yulittlemoon/minote-Obsidian)
- [Obsidian Plugin Developer Docs](https://marcus.se.net/obsidian-plugin-docs/)

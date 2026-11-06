# 悬浮备忘录（Floating Memo）

一个基于 **React Native / Expo** 的 Android 悬浮窗快捷备忘录：想到什么，随手点一下屏幕边缘的气泡，输完即走，不打断当前正在做的事。

## 功能

- **主界面**：清爽的备忘列表，每条显示内容、创建时间、一键复制、删除。
- **顶部开关**：一键开启 / 关闭悬浮窗。
- **悬浮气泡（核心）**：开启后屏幕边缘出现可拖动的小气泡；点击弹出快速输入框，点「快速保存」即缩回气泡，可悬浮在网页、聊天等任意 App 之上。
- **本地存储**：全部内容用 AsyncStorage 保存在本机，重启不丢。
- **深浅色**：浅色 / 深色 / 跟随系统三种主题，悬浮输入框同步适配。

## 重要提示：为什么不能用 Expo Go

悬浮窗需要 Android 的 `SYSTEM_ALERT_WINDOW` 权限和原生 `WindowManager` 悬浮层，这是**原生代码**。Expo Go 只包含 Expo 自带的原生模块，无法加载本项目自定义的原生模块，因此**必须做一次开发构建 / 原生构建**才能运行。

- 主界面（列表、存储、主题）这部分是纯 JS，逻辑上可移植；
- 悬浮气泡与快速输入框由本地原生模块实现，见 [`modules/floating-memo/`](modules/floating-memo)。

## 目录结构

```
floating-memo/
├── App.tsx                     # 入口：主界面
├── src/
│   ├── theme.ts                # 浅色/深色主题色板
│   ├── storage.ts              # AsyncStorage 读写
│   ├── types.ts / format.ts
│   └── components/MemoItem.tsx # 备忘列表项
├── modules/floating-memo/          # 本地原生模块（悬浮气泡 + 快速输入浮层）
│   ├── expo-module.config.json
│   ├── index.ts / src/*.ts     # JS 侧封装与类型
│   └── android/src/main/java/.../  # Kotlin 实现
├── app.json                    # 应用名、包名、悬浮窗权限
└── eas.json                    # EAS 构建配置
```

## 构建 / 运行

### 方式一：EAS 云构建（推荐，直接得到可安装 APK）

无需本地 Android SDK，用 Expo 账号在云端构建：

```bash
npm install -g eas-cli        # 或 npx eas-cli@latest
eas login                     # 登录 Expo 账号
eas build --platform android --profile preview
```

构建完成后会给出 APK 下载链接，下载安装到手机即可。`preview` 配置已设置为产出 APK（见 `eas.json`）。

### 方式二：本地开发构建

需要本机装好 Android SDK / Android Studio 并连上设备：

```bash
npx expo run:android
```

### 开发调试

```bash
npx expo start
```

## 首次使用

1. 打开应用，点顶部「悬浮窗」开关。
2. 首次会跳转系统授权页，开启「显示在其他应用上层」权限。
3. 回到应用，屏幕边缘出现 📝 气泡，拖动可移动位置。
4. 切到任意 App，点气泡即可快速记录。

## 实现说明与已知限制

- **悬浮层生命周期**：气泡以 `TYPE_APPLICATION_OVERLAY` 添加，应用退到后台后气泡仍然显示，能正常在浏览器/聊天里记录。但若系统在内存紧张时杀掉应用进程，气泡会随之消失（需重新打开应用开启）。如需「进程被杀后自动复活」，可进一步接入前台服务（Foreground Service + 常驻通知）。
- **气泡位置**：位置会记住（存在 SharedPreferences），下次开启回到原位。
- **原生模块位置**：`modules/floating-memo/android/.../FloatingMemoModule.kt`（模块定义）与 `FloatingMemoOverlay.kt`（气泡 + 输入浮层）。改气泡颜色、大小、文案都在 `FloatingMemoOverlay.kt` 里。
- 修改原生代码后需重新构建（`npx expo run:android` 或重新 `eas build`），Fast Refresh 不会生效。

## 常用命令

```bash
npx tsc --noEmit        # 类型检查
npx expo lint           # 代码检查
npx expo-doctor         # 依赖与配置诊断
```

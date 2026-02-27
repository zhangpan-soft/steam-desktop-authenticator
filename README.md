# Steam Desktop Authenticator

A desktop authenticator for Steam, built with Electron and Vue 3.

[English](#english) | [中文](#chinese)

---

<span id="english"></span>

## 🇬🇧 English

### Introduction
Steam Desktop Authenticator is a desktop application that provides the functionality of the Steam Mobile Authenticator. It allows you to generate 2FA codes and confirm trades/market listings directly from your computer without needing a phone.

### Features
- **Cross-Platform**: Runs on Windows, macOS, and Linux.
- **Multiple Accounts**: Manage multiple Steam accounts easily.
- **2FA Codes**: Generate Steam Guard codes instantly.
- **Confirmations**: View, accept, or cancel trade and market confirmations.
- **Import**: Support importing `.maFile` from other desktop authenticators (e.g., SDA).
- **Encryption**: Secure your account data with a passkey.
- **Proxy Support**: Configure HTTP/SOCKS5 proxies for network requests.

### Installation
Go to the Releases page to download the installer for your operating system.

### Development

#### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

#### Setup
```bash
# Install dependencies
npm install
```

#### Run in Development Mode
```bash
npm run dev
```

#### Build for Production
```bash
npm run build
```

### Security & Disclaimer
This project is not affiliated with Valve Corporation or Steam. Use it at your own risk.

Your account secrets (shared_secret, identity_secret) are stored locally. If you enable encryption, they are encrypted using your passkey. **Never share your `.maFile` or secrets with anyone.**

Back to Top

---

<span id="chinese"></span>

## 🇨🇳 中文

### 简介
Steam Desktop Authenticator 是 Steam 移动验证器的桌面版实现。它允许您直接在电脑上生成 2FA 验证码并确认交易或市场挂单，而无需使用手机。本项目基于 Electron 和 Vue 3 构建。

### 功能特性
- **跨平台**: 支持 Windows, macOS 和 Linux。
- **多账号管理**: 轻松管理多个 Steam 账号。
- **2FA 验证码**: 实时生成 Steam Guard 令牌。
- **交易确认**: 查看、接受或取消交易和市场确认。
- **导入功能**: 支持从其他桌面验证器（如 SDA）导入 `.maFile` 文件。
- **安全加密**: 支持设置密码（Passkey）加密存储本地数据。
- **代理支持**: 支持配置 HTTP/SOCKS5 代理。

### 安装
请前往 Releases 页面下载对应您操作系统的安装包。

### 开发指南

#### 环境要求
- Node.js (推荐 v18 或更高版本)
- npm 或 yarn

#### 初始化
```bash
# 安装依赖
npm install
```

#### 开发模式运行
```bash
npm run dev
```

#### 打包构建
```bash
npm run build
```

### 安全与免责声明
本项目与 Valve Corporation 或 Steam 无关。使用本软件产生的风险由您自行承担。

您的账号密钥（shared_secret, identity_secret）存储在本地。如果您启用了加密，它们将使用您的密码进行加密。**切勿将您的 `.maFile` 或密钥分享给任何人。**

回到顶部

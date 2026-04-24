# Project Overview

Last updated: 2026-04-24

This document captures the current project structure and implemented functionality of the repository, based on the code snapshot that exists right now. The goal is to avoid re-analyzing the whole codebase from scratch in later sessions.

## 1. Project Positioning

This repository is a single-package desktop application built with:

- Electron
- Vue 3
- Vite
- TypeScript
- Element Plus

It is not a monorepo. The application is a desktop implementation of Steam Mobile Authenticator capabilities, with the core Steam business logic living in the Electron main process and the renderer layer mainly handling UI, dialogs, and IPC calls.

## 2. High-Level Architecture

The project can be understood as four main layers:

1. Renderer layer (`src/`)
   - Vue pages and components
   - UI interactions
   - IPC invocations to Electron
   - i18n and local presentation logic

2. Electron main process (`electron/`)
   - Window lifecycle and child windows
   - IPC handlers
   - Background polling and desktop notifications
   - Access to local files and local storage

3. Steam domain layer (`electron/steam/`, `electron/steam/models/`)
   - Steam session login and refresh
   - Steam Guard / TOTP generation
   - Confirmation list and accept/reject actions
   - Authenticator enrollment flow
   - Steam notification polling
   - Inventory fetching model

4. Local persistence layer (`electron/db/`, local `.maFile`)
   - `settings.json`
   - per-account `.maFile`
   - optional encrypted account storage
   - `paint_index.json`

## 3. Current Directory Structure

```text
steam-desktop-authenticator/
├── src/                         Vue renderer layer
│   ├── views/                   Page-level views
│   ├── components/              Business components and dialogs
│   ├── i18n/                    Localization setup and translations
│   ├── router/                  Vue Router configuration
│   └── utils/                   Renderer-side helpers
├── electron/                    Electron main process and business logic
│   ├── ipc/                     IPC handler registration
│   ├── db/                      Lowdb-based local storage
│   ├── steam/                   Steam API helpers and domain logic
│   └── utils/                   HTTP, runtime, browser helpers
├── public/                      Static assets
├── build/                       App icon build output/resources
├── dist/                        Renderer build artifacts
├── dist-electron/               Electron build artifacts
├── release/                     Packaged release output
├── tests/                       Misc sample/debug assets, not real tests
└── .github/workflows/           CI/CD release workflow
```

## 4. Key Entry Files and Responsibilities

### Renderer entry

- `src/main.ts`
  - Bootstraps Vue
  - Reads settings from IPC
  - Initializes i18n
  - Mounts Element Plus and router

- `src/App.vue`
  - Only renders `<router-view />`

- `src/router/index.ts`
  - Current routes:
    - `/` -> home
    - `/steam/confirmations` -> confirmations window
    - `/steam/cs2-inventory` -> native CS2 inventory window
    - `/steam/login` -> child-window Steam relogin page

### Main renderer view

- `src/views/HomeView.vue`
  - Main application window
  - Hosts:
    - header menu
    - setup new account
    - setup encryption
    - token display
    - confirmation window launcher
    - account list
    - first-run initialization dialog
    - passkey dialog when encrypted

- `src/views/steam/Confirmations.vue`
  - Separate confirmations window
  - Loads account confirmations
  - Supports viewing details
  - Supports accept / reject actions

### Main Electron entry

- `electron/main.ts`
  - Initializes IPC
  - Imports window manager

- `electron/window-manager.ts`
  - Creates main window and child windows
  - Handles background polling
  - Performs account health checks before confirmation polling
  - Shows desktop notifications

- `electron/updater.ts`
  - Initializes `electron-updater`
  - Checks GitHub Releases for updates
  - Prompts before downloading and before restarting to install
  - Opens confirmations child windows
  - Synchronizes paint index cache in background

### IPC layer

- `electron/ipc/index.ts`
  - Registers grouped IPC handlers

- `electron/ipc/system.ts`
  - File dialogs
  - Read file / read `.maFile`
  - Import `.maFile`
  - Window open/close
  - Settings get/set
  - Runtime context get/set
  - Passkey setup/unlock flow

- `electron/ipc/steam.ts`
  - Steam login
  - Refresh login
  - Submit Steam Guard code
  - Cancel login
  - Get confirmations
  - Accept/reject confirmations
  - Generate token/code
  - Load account from local file
  - Add authenticator
  - Open notifications/community windows

### Steam core model layer

- `electron/steam/models/index.ts`
  - Core business layer of the project
  - Contains:
    - `SteamSessionModel`
    - `SteamAccountModel`
    - `SteamTimeSync`
    - `SteamPhoneModel`
    - `SteamNotificationModel`
    - `SteamEconModel`
    - mobile device registration flow

### Local storage

- `electron/db/index.ts`
  - `SettingsDb`
  - `SteamAccountDb`
  - `PaintIndexDb`
  - optional account encryption using AES-256-GCM for local `.maFile` storage format used by this app

- `electron/ma-file.ts`
  - Reads external `.maFile`
  - Supports SDA-style encrypted maFile decryption
  - Used for importing old/external maFiles

## 5. Renderer Component Breakdown

### Core business components

- `HeaderMenu.vue`
  - App menu
  - Import account
  - Settings
  - Language switch
  - Exit
  - Selected account actions:
    - open notifications
    - open inventory
    - open trade page
    - login again
    - force refresh
    - remove account

- `SteamAccountList.vue`
  - Shows account entries from settings
  - Supports simple filter by account name / steamid
  - Emits selected account event

- `SteamToken.vue`
  - Refreshes Steam Guard code every second
  - Shows progress bar for 30-second cycle
  - Supports clipboard copy

- `ViewConfirmations.vue`
  - Opens confirmations child window for selected account

- `SetupNewAccount.vue`
  - Starts new-account authenticator enrollment flow
  - Reuses login dialog
  - Handles phone number collection
  - Handles SMS code prompt
  - Drives authenticator state machine

- `ImportAccount.vue`
  - Imports local `.maFile`
  - Supports old SDA encrypted format
  - After import, prompts login to refresh/save session

- `SteamLogin.vue`
  - Account/password login dialog
  - Handles 2FA prompt
  - Listens for login status IPC events

- `Settings.vue`
  - Periodic check toggle
  - Poll interval
  - Check-all toggle
  - Auto-confirm trade toggle
  - Auto-confirm market toggle
  - Proxy
  - Request timeout

- `Passkey.vue`
  - Unlock/set passkey dialog

- `Initializing.vue`
  - First-run maFiles directory selection

### Shared UI wrappers

- `CustomDialog.vue`
  - Reusable dialog shell

- `CustomContainer.vue`
  - Reusable container layout

## 6. Implemented Feature List

The following features are currently implemented in code.

### A. Account and storage

- Multi-account management
- Account index stored in `settings.entries`
- Per-account local `.maFile` storage
- First-run selection of the maFiles folder
- Account removal from local settings list
- Import of existing `.maFile`
- Import of old SDA encrypted `.maFile`
- Optional local passkey-based encryption for stored account data
- Runtime passkey unlock before using encrypted data

### B. Steam login and session

- Steam username/password login
- Login cancellation
- Steam Guard code submission
- Login status events pushed from main process to renderer
- Refresh-token based session refresh
- Manual force refresh from menu
- Session auto-check / refresh on timer
- Cookie generation for Steam web pages

### C. Steam Guard / 2FA

- Generate Steam Guard token
- Auto-refresh token display every second
- Copy token to clipboard
- Time sync against Steam for code generation

### D. Authenticator enrollment

- Register mobile device
- Add authenticator via Steam APIs
- Handle duplicate authenticator / replacement flow
- Ask for phone number when required
- Ask for SMS code when required
- Wait for email confirmation state
- Finalize authenticator enrollment
- Persist newly enrolled guard data locally

### E. Confirmations

- Fetch confirmation list
- Show confirmations in dedicated child window
- Show confirmation details
- Accept confirmation
- Cancel confirmation
- Distinguish trade / market / account / phone / recovery types in UI

### F. Background notifications and automation

- Background periodic polling after app startup
- Polling interval configurable from settings
- Desktop notifications for confirmation items
- Desktop notifications for pending gifts
- Desktop notifications for friend invites
- Desktop notifications for family invites
- Auto-confirm trades when enabled
- Auto-confirm market transactions when enabled
- Notification click opens the confirmations window or community page

### G. Steam web integration

- Open Steam notifications page in Electron browser window
- Open Steam inventory page in Electron browser window
- Open Steam trade offers page in Electron browser window
- Inject session cookies into dedicated browser window session
- Optional proxy applied to those browser windows

### H. Settings and localization

- English / Chinese localization
- Language switch stored in settings
- Proxy setting
- Request timeout setting
- Periodic check settings

### I. Packaging and release

- Electron Builder packaging for macOS
- Electron Builder packaging for Windows
- Electron Builder packaging for Linux
- GitHub Actions workflow for tagged release builds
- Draft GitHub release upload on tag push
- Runtime update checks via GitHub Releases and `latest*.yml` metadata

## 7. Hidden or Partially Exposed Capabilities

These capabilities exist in code, but are not fully surfaced in the current UI/IPC design.

### CS2 inventory model exists in code

`SteamEconModel` already implements:

- Steam inventory fetching
- CS2 inventory fetch across multiple contexts
- inventory description merge
- asset property merge
- float / paint seed / paint index parsing
- sticker float extraction
- cooldown date parsing

However:

- there is no active IPC handler exposing this inventory data to the renderer
- there is no built-in inventory view in the current UI
- the current menu "Inventory" action opens Steam Community web inventory, not an app-native inventory page

### Paint index background cache exists

`window-manager.ts` periodically downloads CS skin data and stores a `paint_index.json` mapping.

This is currently used only by the inventory model fallback logic and not exposed directly in UI.

## 8. Things That Look Present but Are Not Fully Implemented

These are useful to remember so later reviews do not assume they already exist.

- `tests/` is not a real automated test suite right now.
  - Current contents are sample/debug files.

## 9. Important Persistent Files

The app relies on a few important local files:

- `settings.json`
  - application-level settings
  - account entry list
  - proxy / timeout / language / polling switches

- `<account>.maFile`
  - per-account guard/session data
  - may be plain JSON or app-encrypted content

- imported external `.maFile`
  - supports old SDA encrypted file format

- `paint_index.json`
  - cached mapping for CS item paint index fallback usage

## 10. Build and Runtime Notes

- `vite.config.ts`
  - builds Vue renderer
  - builds Electron main + preload via `vite-plugin-electron`
  - excludes several Steam-related packages from bundling

- `electron-builder.json5`
  - defines desktop packaging targets and artifact naming

- `.github/workflows/release.yml`
  - builds tagged releases on macOS, Windows, Linux
  - uploads release assets, updater metadata, and blockmaps as draft release files

## 11. Current Practical Mental Model

If revisiting this project later, the fastest way to reason about it is:

1. Main UI starts in `src/views/HomeView.vue`
2. UI actions call IPC in `electron/ipc/system.ts` and `electron/ipc/steam.ts`
3. IPC delegates real work to `electron/steam/models/index.ts`
4. Persistent state lives in `electron/db/index.ts`
5. Background polling and notifications live in `electron/window-manager.ts`

## 12. Summary

Current project status can be summarized as:

- The core Steam authenticator workflow is implemented
- Multi-account local desktop usage is implemented
- Import + encryption + login + token + confirmations are implemented
- Background notification and auto-confirm behavior is implemented
- Native CS2 inventory UI is implemented
- Auto-update checking is implemented through GitHub Releases
- Automated tests are not implemented

## 13. Suggested Maintenance Rule

When major features or structure change, update this file together with code changes, especially if any of the following happen:

- new pages or routes are added
- new IPC channels are introduced
- inventory UI gets exposed
- updater is introduced
- test suite is added
- storage format changes

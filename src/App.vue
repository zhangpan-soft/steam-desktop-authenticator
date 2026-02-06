<script setup lang="ts">
import {onMounted, reactive, ref} from 'vue'
import {Hide, Lock, Unlock, UserFilled, View} from "@element-plus/icons-vue";
import {ElMessage, FormInstance, FormItemRule, FormRules} from "element-plus";

const runtimeContext = window.state.runtimeContext
const settings = window.state.settings
const loginFormRef = ref<FormInstance>()

type CurrentDataType = {
  showImportAccountModal: boolean
  importAccountForm: {
    passkey: string
  },
  showLoginModal: boolean,
  filterText: string,
  showSdaPasskeyModal: boolean,
  showInitModal: boolean,
  loginForm: LoginFormType,
  showSettingsModal: boolean
}

type LoginFormType = {
  account_name: string,
  password: string
  steamGuardCode: string
  showSteamGuardCode: boolean
  showAccountName: boolean,
  showPassword: boolean,
  accountPasswordLoginCancelLoading: boolean
  accountPasswordLoginConfirmLoading: boolean
  steamGuardCodeCancelLoading: boolean
  steamGuardCodeConfirmLoading: boolean
  loginType: 'NewAccount' | 'ImportSda' | 'RefreshToken',
  passwordLocked: boolean,
  passwordInputType: 'password' | 'text',
  rules: FormRules
}

const defaultAccountNameRules: FormItemRule[] = [
  {
    required: true,
    message: 'Please input your account name',
    trigger: 'blur'
  }
]

const defaultPasswordRules: FormItemRule[] = [
  {
    required: true,
    message: 'Please input your password',
    trigger: 'blur'
  }
]

const defaultSteamGuardCodeRules: FormItemRule[] = [
  {
    required: true,
    message: 'Please input your Steam Guard Code',
    trigger: 'blur'
  },
  {
    validator: (rule, value, callback) => {
      console.log(rule)
      if (value.length !== 5) {
        callback(new Error('Steam Guard Code must be 5 digits'))
      } else {
        callback()
      }
    }
  }
]

const defaultLoginForm: LoginFormType = {
  account_name: '',
  password: '',
  steamGuardCode: '',
  showSteamGuardCode: false,
  showAccountName: true,
  showPassword: true,
  accountPasswordLoginCancelLoading: false,
  accountPasswordLoginConfirmLoading: false,
  steamGuardCodeCancelLoading: false,
  steamGuardCodeConfirmLoading: false,
  loginType: 'NewAccount',
  passwordLocked: true,
  passwordInputType: 'password',
  rules: {
    account_name: [...defaultAccountNameRules],
    password: [...defaultPasswordRules],
    steamGuardCode: [...defaultSteamGuardCodeRules]
  }
}

const currentData = reactive<CurrentDataType>({
  showImportAccountModal: false,
  showSettingsModal: false,
  importAccountForm: {
    passkey: ''
  },
  showLoginModal: false,
  filterText: '',
  showSdaPasskeyModal: false,
  showInitModal: false,
  loginForm: {...defaultLoginForm}
})

type SteamLoginOptions = {
  account_name?: string,
  password?: string,
  steamGuardCode?: string,
  refresh_token?: string,
  shared_secret?: string
}

function steamLogin(options: SteamLoginOptions) {
  return window.ipcRenderer.invoke('steam:login', options)
}


function handleExit() {

}

function copyToken() {

}

function selectAccount(acc: any) {

}

function handleImportAccountConfirm() {

}

function initialSelect(type: number) {
  if (type === 1) {
    settings.first_run = false
    currentData.showInitModal = false
    return
  }
  window.ipcRenderer.invoke('showOpenDialog', {
    title: 'Select The MaFiles Dir',
    defaultPath: settings.maFilesDir,
    properties: ['openDirectory'],
  }).then((result: any) => {
    if (result.canceled) {
      return
    }
    settings.maFilesDir = result.filePaths[0]
    settings.first_run = false
    currentData.showInitModal = false
  })
}

function handleAccountPasswordLoginCancel() {
  currentData.showLoginModal = false
  currentData.loginForm.accountPasswordLoginConfirmLoading = true
  window.ipcRenderer.invoke('steam:cancelLogin',).then(() => {
    currentData.loginForm.accountPasswordLoginConfirmLoading = false
  })
}

function handleAccountPasswordLoginConfirm(formEl: FormInstance | undefined) {
  if (!formEl) {
    return
  }
  currentData.loginForm.accountPasswordLoginConfirmLoading = true
  currentData.loginForm.rules['steamGuardCode'] = []
  console.log('currentData', currentData)
  formEl.validate((valid: boolean) => {
    if (!valid) {
      currentData.loginForm.accountPasswordLoginConfirmLoading = false
      return
    }
    steamLogin({
      account_name: currentData.loginForm.account_name,
      password: currentData.loginForm.password,
    }).then()
  })
}

function handleSteamGuardCodeCancel() {
  window.ipcRenderer.invoke('steam:cancelLogin',).then()
}

function handleSteamGuardCodeConfirm() {
  window.ipcRenderer.invoke('steam:submitSteamGuard').catch(err => {
    ElMessage.error(err.message)
  })
}

function handleSetupNewAccount() {
  currentData.showLoginModal = true
  currentData.loginForm = {...defaultLoginForm}
  currentData.loginForm.rules['steamGuardCode'] = []
}


onMounted(() => {
  currentData.showInitModal = settings.first_run
})

window.ipcRenderer.on('steam:message:login-status-changed', (event, args: SteamLoginEvent) => {
  console.log('----------------------')
  console.log(event,args)
  if (currentData.loginForm.account_name !== args.account_name){
    window.ipcRenderer.invoke('steam:cancelLogin',{account_name: currentData.loginForm.account_name}).then()
    return
  }
  if (args.status === 'LoginSuccess'){
    // todo
    ElMessage.success('Login Success')
    currentData.loginForm = {...defaultLoginForm}
    currentData.showLoginModal = false
  } else if (args.status === 'Timeout'){
    ElMessage.error('Login Timeout, Please Re-Try Later')
    window.ipcRenderer.invoke('steam:cancelLogin',{account_name: currentData.loginForm.account_name}).then()
  } else if (args.status === 'Need2FA'){
    currentData.loginForm.showSteamGuardCode = true
    currentData.loginForm.showAccountName = false
    currentData.loginForm.showPassword = false
    currentData.loginForm.rules['steamGuardCode'] = [...defaultSteamGuardCodeRules]
  } else if (args.result) {
    ElMessage.error(`Login Failed, Please Re-Try Later.${args.result}`)
    window.ipcRenderer.invoke('steam:cancelLogin',{account_name: currentData.loginForm.account_name}).then()
  } else if (args.error_message) {
    ElMessage.error(`Login Failed, ${args.error_message}.`)
    window.ipcRenderer.invoke('steam:cancelLogin',{account_name: currentData.loginForm.account_name}).then()
  } else {
    ElMessage.error(`Login Failed, Please Re-Try Later.`)
    window.ipcRenderer.invoke('steam:cancelLogin',{account_name: currentData.loginForm.account_name}).then()
  }
})
</script>

<template>
  <div class="app-container">

    <!--  顶部菜单  -->
    <div class="custom-menubar">
      <el-dropdown trigger="click" size="small">
        <span class="menu-item-text">File</span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="currentData.showImportAccountModal=true;currentData.importAccountForm.passkey=''">
              Import Account
            </el-dropdown-item>
            <el-dropdown-item @click="currentData.showSettingsModal=true">Settings</el-dropdown-item>
            <el-dropdown-item divided @click="handleExit">Exit</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-dropdown trigger="click" size="small">
        <span class="menu-item-text">Selected Account</span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>Login again</el-dropdown-item>
            <el-dropdown-item>Force refresh</el-dropdown-item>
            <el-dropdown-item divided>Remove</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <!--  核心内容  -->
    <div class="main-content">
      <!--   顶部按钮   -->
      <div class="header-actions">
        <el-button-group class="full-width-group">
          <el-button plain @click="handleSetupNewAccount">Setup New Account</el-button>
          <el-button plain>Setup Encryption</el-button>
        </el-button-group>
      </div>

      <div class="section-card">
        <div class="section-title">Login Token</div>
        <div class="token-wrapper">
          <el-input
              v-model="runtimeContext.token"
              readonly
              class="token-input"
          >
            <template #suffix>
              <el-button type="primary" link @click="copyToken">Copy</el-button>
            </template>
          </el-input>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: runtimeContext.progress + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">Account</div>
        <el-button type="primary" plain class="full-width-btn">
          View Confirmations
        </el-button>
      </div>

      <div class="list-section">
        <div class="list-container">
          <el-empty v-if="settings.entries.length === 0" :image-size="60" description="No accounts loaded"/>

          <div
              v-else
              v-for="acc in settings.entries"
              :key="acc.steamid"
              class="account-item"
              :class="{ 'is-selected': runtimeContext.selectedSteamid === acc.steamid }"
              @click="selectAccount(acc)"
          >
            <div class="account-info">
              <div class="account-name">
                <el-text :type="runtimeContext.selectedSteamid === acc.steamid?'primary':'default'">
                  {{ acc.filename.toString().split(".")[0] }}
                </el-text>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div class="footer">
        <div class="filter-row">
          <span class="label">Filter:</span>
          <el-input v-model="currentData.filterText" size="small" class="filter-input"/>
        </div>
        <div class="status-row">
          <el-link type="info" :underline="false">Check for updates</el-link>
          <span class="version">v1.0.15</span>
        </div>
      </div>

    </div>

    <el-dialog
        v-model="currentData.showImportAccountModal"
        title="Import Account"
        width="340px"
        :close-on-click-modal="false"
        center
        align-center
        append-to-body>
      <div class="login-form">
        <div class="form-row">
          <p class="login-desc">
            Enter your encryption passkey if your .maFile is encrypted:
          </p>
          <el-input v-model="currentData.importAccountForm.passkey" placeholder=""/>
        </div>
        <p class="login-desc">
          If you import an encrypted .maFile, the manifest file must be next to it.
        </p>
        <div class="dialog-footer">
          <el-button type="default" @click="currentData.showImportAccountModal = false">Cancel</el-button>
          <el-button type="default" @click="handleImportAccountConfirm">Select .maFile file to Import</el-button>
        </div>
      </div>
    </el-dialog>

    <el-dialog
        v-model="currentData.showSdaPasskeyModal"
        title="Input SDA Passkey"
        width="340px"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
        center
        align-center
        append-to-body>
      <el-input v-model="runtimeContext.passkey" placeholder="Please Input SDA Passkey">
        <template #append @click="currentData.showSdaPasskeyModal = false">确定</template>
      </el-input>
    </el-dialog>

    <el-dialog
        v-model="currentData.showInitModal"
        title="Initializing Settings"
        width="340px"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
        center
        align-center
        append-to-body>
      <el-row>
        <el-text type="info" size="small">
          Please Select the MaFiles Folder
        </el-text>
      </el-row>
      <el-row>
        <el-button type="default" style="width: 100%" @click="initialSelect(1)">Default</el-button>
      </el-row>
      <el-row>
        <el-button type="default" style="width: 100%" @click="initialSelect(2)">Custom</el-button>
      </el-row>
    </el-dialog>

    <el-dialog
        v-model="currentData.showLoginModal"
        title="Steam Login"
        width="340px"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
        center
        align-center
        append-to-body>
      <el-form :model="currentData.loginForm" label-width="auto" label-position="top" ref="loginFormRef"
               :rules="currentData.loginForm.rules">
        <el-form-item prop="account_name" label="Account" v-if="currentData.loginForm.showAccountName">
          <el-input v-model="currentData.loginForm.account_name"
                    :readonly="currentData.loginForm.loginType==='ImportSda'">
            <template #prefix>
              <el-icon>
                <UserFilled/>
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item prop="password" label="Password" v-if="currentData.loginForm.showPassword">
          <el-input v-model="currentData.loginForm.password" :type="currentData.loginForm.passwordInputType">
            <template #prefix>
              <el-icon v-if="currentData.loginForm.passwordLocked">
                <Lock/>
              </el-icon>
              <el-icon v-if="!currentData.loginForm.passwordLocked">
                <Unlock/>
              </el-icon>
            </template>
            <template #suffix>
              <el-icon v-if="currentData.loginForm.passwordLocked"
                       @click="currentData.loginForm.passwordInputType='text';currentData.loginForm.passwordLocked=false">
                <Hide/>
              </el-icon>
              <el-icon v-if="!currentData.loginForm.passwordLocked"
                       @click="currentData.loginForm.passwordInputType='password';currentData.loginForm.passwordLocked=true">
                <View/>
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item prop="steamGuardCode" label="Steam Guard" v-if="currentData.loginForm.showSteamGuardCode">
          <el-text size="small">
            Please enter your Steam Guard Code Or approve login on the Steam Guard App
          </el-text>
          <el-input v-model="currentData.loginForm.steamGuardCode"/>
        </el-form-item>
        <el-form-item v-if="currentData.loginForm.showPassword && currentData.loginForm.showAccountName">
          <el-button type="default" :loading="currentData.loginForm.accountPasswordLoginCancelLoading"
                     @click="handleAccountPasswordLoginCancel">Cancel
          </el-button>
          <el-button type="default" :loading="currentData.loginForm.accountPasswordLoginConfirmLoading"
                     @click="handleAccountPasswordLoginConfirm(loginFormRef)">Confirm
          </el-button>
        </el-form-item>
        <el-form-item v-if="currentData.loginForm.showSteamGuardCode">
          <el-button type="default" :loading="currentData.loginForm.steamGuardCodeCancelLoading"
                     @click="handleSteamGuardCodeCancel">Cancel
          </el-button>
          <el-button type="default" :loading="currentData.loginForm.steamGuardCodeConfirmLoading"
                     @click="handleSteamGuardCodeConfirm">Confirm
          </el-button>
        </el-form-item>
      </el-form>
    </el-dialog>

    <el-dialog
        v-model="currentData.showSettingsModal"
        title="Settings"
        width="340px"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="true"
        center
        align-center
        append-to-body
    >
      <el-row class="settings-row">
        <el-checkbox v-model="settings.periodic_checking" size="small"/>
        <el-text size="small" class="settings-text" @click="settings.periodic_checking = !settings.periodic_checking">
          Periodically check for new confirmations and show a popup when they arrive
        </el-text>
      </el-row>

      <el-row class="settings-row">
        <el-input
            v-model="settings.periodic_checking_interval"
            type="number"
            size="small"
            style="width: 50px; flex-shrink: 0;"
        />
        <el-text size="small" class="settings-text">
          Seconds between checking for confirmations
        </el-text>
      </el-row>

      <el-row class="settings-row">
        <el-checkbox v-model="settings.periodic_checking_checkall" size="small"/>
        <el-text size="small" class="settings-text"
                 @click="settings.periodic_checking_checkall = !settings.periodic_checking_checkall">
          Check all accounts for confirmations
        </el-text>
      </el-row>

      <el-row class="settings-row">
        <el-checkbox v-model="settings.auto_confirm_market_transactions" size="small"/>
        <el-text size="small" class="settings-text"
                 @click="settings.auto_confirm_market_transactions = !settings.auto_confirm_market_transactions">
          Auto-confirm market transactions
        </el-text>
      </el-row>

      <el-row class="settings-row">
        <el-checkbox v-model="settings.auto_confirm_trades" size="small"/>
        <el-text size="small" class="settings-text"
                 @click="settings.auto_confirm_trades = !settings.auto_confirm_trades">
          Auto-confirm transactions
        </el-text>
      </el-row>
      <el-row class="settings-row">
        <el-text size="small" class="settings-text">
          Please setting the httpProxy or socksProxy. If in China
        </el-text>
        <el-input v-model="settings.proxy" size="small"
                  placeholder="http[s]|socks5://username@password:ip:port"></el-input>
      </el-row>

    </el-dialog>
  </div>
</template>

<style>
#app {
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  text-align: left !important;
  width: 100vw !important;
  height: 100vh !important;
}

html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  overflow: hidden !important;
  background-color: #f5f7fa;
}

/* 核心布局样式 */
.settings-row {
  display: flex; /* 启用 Flex 布局 */
  align-items: center; /* 垂直居中核心属性 */
  flex-wrap: nowrap; /* 禁止整个行换行 */
  margin-bottom: 12px; /* 行间距 */
  width: 100%;
}

.settings-text {
  flex: 1; /* 占满右侧剩余宽度 */
  margin-left: 10px; /* 左侧控件和文字的间距 */
  white-space: normal; /* 允许文字换行 (核心) */
  word-break: break-word; /* 防止长单词溢出 */
  line-height: 1.4; /* 增加行高，多行时更美观 */
  cursor: pointer; /* 鼠标变成手型，提示可点击 */
}

/* 覆盖 Token 输入框样式 */
.token-input .el-input__wrapper {
  box-shadow: 0 0 0 1px #dcdfe6 inset !important;
  font-family: monospace;
  font-size: 18px;
  font-weight: bold;
  color: #409EFF;
}
</style>

<style scoped>
/* App 容器 */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  box-sizing: border-box;
}

/* 菜单栏 */
.custom-menubar {
  height: 36px;
  background: #ffffff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  padding: 0 10px;
  flex-shrink: 0;
  z-index: 10;
}

.menu-item-text {
  font-size: 13px;
  color: #303133;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.menu-item-text:hover {
  background-color: #f2f3f5;
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
  gap: 12px;
}

/* 通用卡片 */
.section-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  width: 100%;
  box-sizing: border-box;
}

.section-title {
  font-size: 12px;
  color: #909399;
  font-weight: 600;
  margin-bottom: 6px;
}

/* 顶部按钮 */
.header-actions {
  width: 100%;
}

.full-width-group {
  display: flex;
  width: 100%;
}

.full-width-group .el-button {
  flex: 1;
}

/* Token */
.token-wrapper {
  position: relative;
}

.progress-bar {
  height: 4px;
  background: #f0f2f5;
  margin-top: 6px;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #67c23a;
  transition: width 0.1s linear;
}

/* 列表区域 */
.list-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.list-container {
  flex: 1;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow-y: auto;
  padding: 4px;
}

/* 列表项样式 */
.account-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;
  border-radius: 4px;
  margin-bottom: 2px;
}

.account-item:hover {
  background-color: #f5f7fa;
}

.account-item.is-selected {
  background-color: #ecf5ff;
  border-left: 3px solid #409EFF;
}

.account-avatar {
  background-color: #c0c4cc;
  margin-right: 10px;
  flex-shrink: 0;
}

.account-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.account-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-code {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
  margin-top: 2px;
}

/* 底部区域 */
.footer {
  flex-shrink: 0;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.filter-input {
  flex: 1;
}

.label {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.status-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #c0c4cc;
}

.full-width-btn {
  width: 100%;
}

/* --- 弹窗样式 --- */
.form-row {
  margin-bottom: 12px;
}

.form-row label {
  display: block;
  font-size: 13px;
  color: #333;
  margin-bottom: 4px;
}

.login-desc {
  font-size: 12px;
  color: #606266;
  line-height: 1.4;
  margin: 16px 0;
  background-color: #f4f4f5;
  padding: 8px;
  border-radius: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.login-btn {
  width: 100px;
}
</style>

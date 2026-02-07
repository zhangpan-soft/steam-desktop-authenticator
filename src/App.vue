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
  rules: FormRules,
  steamGuardCodeText: string,
  currentAuthResult: {
    access_token: string
    refresh_token: string
    steamid: string
    cookies: string[]
    account_name: string
  }
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
  },
  currentAuthResult: {
    access_token: '',
    refresh_token: '',
    steamid: '',
    account_name: '',
    cookies: []
  },
  steamGuardCodeText: ''
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
  console.log(event, args)
  if (currentData.loginForm.account_name !== args.account_name) {
    window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name}).then()
    return
  }
  if (args.status === 'LoginSuccess') {
    // todo
    ElMessage.success('Login Success')
    currentData.showLoginModal = false
    currentData.loginForm.currentAuthResult.access_token = args?.data?.access_token as string
    currentData.loginForm.currentAuthResult.refresh_token = args?.data?.refresh_token as string
    currentData.loginForm.currentAuthResult.steamid = args?.data?.steamid as string
    currentData.loginForm.currentAuthResult.cookies = args?.data?.cookies as string[]
    currentData.loginForm.currentAuthResult.account_name = args?.data?.account_name as string

    if (currentData.loginForm.loginType === 'ImportSda') {

    } else if (currentData.loginForm.loginType === 'RefreshToken') {

    } else if (currentData.loginForm.loginType === 'NewAccount') {

    }
  } else if (args.status === 'Timeout') {
    ElMessage.error('Login Timeout, Please Re-Try Later')
    window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name}).then()
  } else if (args.status === 'Need2FA') {
    currentData.loginForm.showSteamGuardCode = true
    currentData.loginForm.showAccountName = false
    currentData.loginForm.showPassword = false
    currentData.loginForm.rules['steamGuardCode'] = [...defaultSteamGuardCodeRules]
    if (args.valid_actions) {
      if (args.valid_actions.find(value => value.type === 3 || value.type === 4)) {
        currentData.loginForm.steamGuardCodeText = 'Please Input SteamGuard Code Or Confirm In Your SteamGuard App'
      } else if (args.valid_actions.find(value => value.type === 2 || value.type === 5)) {
        currentData.loginForm.steamGuardCodeText = 'Please Input SteamGuard Code Or Confirm In Your Email'
      } else {
        currentData.loginForm.steamGuardCodeText = 'Please Input SteamGuard Code Or Confirm In Your Machine'
      }
    }
  } else if (args.result) {
    ElMessage.error(`Login Failed, Please Re-Try Later.${args.result}`)
    window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name}).then()
  } else if (args.error_message) {
    ElMessage.error(`Login Failed, ${args.error_message}.`)
    window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name}).then()
  } else {
    ElMessage.error(`Login Failed, Please Re-Try Later.`)
    window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name}).then()
  }
})
</script>

<template>
  <el-splitter style="padding: 5px; height: 100%">
    <el-splitter-panel size="420px">
      <div class="left-panel-container">
        <!--  顶部菜单  -->
        <el-header>
          <el-card>
            <el-dropdown trigger="click" size="small">
              <span class="menu-item-text">File</span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                      @click="currentData.showImportAccountModal=true;currentData.importAccountForm.passkey=''">
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
          </el-card>
        </el-header>
        <el-main>

          <el-card>
            <el-button-group class="full-width-group">
              <el-button plain @click="handleSetupNewAccount" size="small">Setup New Account</el-button>
              <el-button plain size="small">Setup Encryption</el-button>
            </el-button-group>
          </el-card>
          <el-card>
            <el-input
                v-model="runtimeContext.token"
                readonly
                class="token-input"
                size="large"
            >
              <template #suffix>
                <el-button type="primary" link @click="copyToken">Copy</el-button>
              </template>
            </el-input>
            <el-progress :percentage="runtimeContext.progress"
                         :show-text="false"
                         :status="runtimeContext.progress>50? 'success': runtimeContext.progress>30?'warning':'exception'"
                         :text-inside="true"/>
          </el-card>
          <el-card>
            <el-button type="default" plain class="full-width-btn">
              View Confirmations
            </el-button>
          </el-card>
          <el-card class="account-list-card">
            <el-empty v-if="settings.entries.length===0" description="No accounts loaded"/>
            <li v-else
                v-for="acc in settings.entries"
                :key="acc.steamid"
                @click="selectAccount(acc)">
              <el-text :type="runtimeContext.selectedSteamid === acc.steamid?'primary':'default'">
                {{ acc.filename.toString().split(".")[0] }}
              </el-text>
            </li>
            <template #footer>
              <el-row>
                <el-input v-model="currentData.filterText" size="small">
                  <template #prefix>Filter:</template>
                </el-input>
              </el-row>
            </template>
          </el-card>
        </el-main>
        <el-footer>
          <el-row justify="space-between" align="middle" style="height: 100%; padding: 0 5px;">
            <el-text size="small">Check for updates</el-text>
            <el-text size="small">v1.0.15</el-text>
          </el-row>
        </el-footer>
      </div>
    </el-splitter-panel>
    <el-splitter-panel>

    </el-splitter-panel>
  </el-splitter>
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
          {{ currentData.loginForm.steamGuardCodeText }}
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
      <el-text size="small" class="settings-text"
               @click="settings.periodic_checking = !settings.periodic_checking">
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
/* 菜单栏 */
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

/* 顶部按钮 */
.full-width-group {
  display: flex;
  width: 100%;
}

.full-width-group .el-button {
  flex: 1;
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

.el-header{
  --el-header-padding: 0px;
  --el-header-height: 35px;
}
.el-main {
  --el-main-padding: 0px;
}

.el-footer {
  --el-footer-padding: 0px;
  --el-footer-height: 30px;
}

.el-card {
  --el-card-padding: 5px;
  margin-top: 5px;
  margin-right: 5px;
}

/* New Layout Styles */
.left-panel-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.el-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.account-list-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.account-list-card :deep(.el-card__body) {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>

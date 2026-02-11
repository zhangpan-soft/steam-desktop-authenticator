<script setup lang="ts">
import {onMounted, reactive} from 'vue'
import {ElMessage} from "element-plus";

const runtimeContext = window.state.runtimeContext
const settings = window.state.settings

type CurrentDataType = {
  showImportAccountModal: boolean
  importAccountForm: {
    passkey: string
  },
  filterText: string,
  showSdaPasskeyModal: boolean,
  showInitModal: boolean,
  showSettingsModal: boolean,
}

const currentData = reactive<CurrentDataType>({
  showImportAccountModal: false,
  showSettingsModal: false,
  importAccountForm: {
    passkey: ''
  },
  filterText: '',
  showSdaPasskeyModal: false,
  showInitModal: false,
})


function handleExit() {

}

function handleViewConfirmations() {
  if (!window.state.runtimeContext.currentAccount) {
    ElMessage.warning('Please select an account first')
    return
  }
  window.ipcRenderer.send('open-window', {
    uri: {
      hash: '/confirmations'
    },
    options: {
      width: 600,   // 改窄，模仿手机/工具宽度
      height: 800,  // 高度适中
      useContentSize: true, // 确保内容区域有这么大
      resizable: false, // 允许调整，但你可以设为 false 固定大小
      minWidth: 600,   // 限制最小宽度
      minHeight: 800,
      maximizable: false,
      minimizable: false,
      show: false,
      icon: 'electron-vite.svg',
      x: screen.width / 2 + 210,
      y: screen.height / 2 - 400,
      title: 'Confirmations'
    }
  })
}

function copyToken() {
  if (runtimeContext.token) {
    navigator.clipboard.writeText(runtimeContext.token).then(() => {
      ElMessage.success('Token copied to clipboard')
    }).catch(() => {
      ElMessage.error('Failed to copy token')
    })
  } else {
    ElMessage.warning('No token to copy')
  }
}

function selectAccount(acc: EntryType) {
  console.log('=============', acc)
  window.state.runtimeContext.currentAccount = {...acc}
}

function handleImportAccountConfirm() {
  window.ipcRenderer.invoke('showOpenDialog', {
    title: 'Select .maFile',
    defaultPath: settings.maFilesDir,
    properties: ['openFile'],
    filters: [
      {
        name: 'maFile', extensions: ['maFile', 'json', 'txt']
      }
    ]
  }).then(result => {
    if (result.canceled) {
      return
    }
    window.ipcRenderer.invoke('importMaFile', {
      path: result.filePaths[0],
      passkey: currentData.importAccountForm.passkey
    }).then(result => {
      // todo
      const {data} = {...result}
      delete data.Session
      window.ipcRenderer.invoke('open-window',{
        uri: {
          hash: '/steamLogin',
          query: {
            loginType: 'ImportSda',
            ...data
          }
        },
        options: {
          width: 420,
          height: 300,
          resizable: false,
          title: 'Steam Login',
          modal: true,
          show: false,
          icon: 'electron-vite.svg',
        }
      })
    }).catch(err => {
      ElMessage.error(err.message)
    })
  })
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


function handleSetupNewAccount() {
  window.ipcRenderer.invoke('open-window', {
    uri: {
      hash: '/steamLogin',
      query: {
        loginType: 'NewAccount'
      }
    },
    options: {
      width: 420,
      height: 300,
      resizable: false,
      title: 'Steam Login',
      modal: true,
      show: false,
      icon: 'electron-vite.svg',
    }
  })
}

onMounted(() => {
  currentData.showInitModal = settings.first_run
})

</script>

<template>
  <div class="container">
    <!--  顶部菜单  -->
    <el-header>
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
    </el-header>
    <el-main>
      <!-- 区域 1: 按钮组 -->
      <div class="section">
        <el-button-group size="small" class="full-width-group">
          <el-button @click="handleSetupNewAccount" size="small">Setup New Account</el-button>
          <el-button size="small">Setup Encryption</el-button>
        </el-button-group>
      </div>
      <el-divider class="custom-divider"/>

      <!-- 区域 2: Token -->
      <div class="section">
        <el-input
            v-model="runtimeContext.token"
            readonly
            class="token-input"
            size="small"
        >
          <template #suffix>
            <el-button type="primary" link @click="copyToken">Copy</el-button>
          </template>
        </el-input>
        <el-progress :percentage="runtimeContext.progress"
                     :show-text="false"
                     :indeterminate="false"
                     :status="runtimeContext.progress>50? 'success': runtimeContext.progress>30?'warning':'exception'"
                     :text-inside="true"/>
      </div>
      <el-divider class="custom-divider"/>

      <!-- 区域 3: View Confirmations -->
      <div class="section">
        <el-button type="default" size="small" class="full-width-btn" @click="handleViewConfirmations">
          View Confirmations
        </el-button>
      </div>
      <el-divider class="custom-divider"/>

      <!-- 区域 4: 账号列表 (自适应高度) -->
      <div class="list-section">
        <el-empty class="el-empty" v-if="settings.entries.length===0" description="No accounts loaded"/>
        <div v-else class="list-container">
          <el-card
              v-for="acc in settings.entries"
              :key="acc.steamid"
              @click="selectAccount(acc)"
              class="list-item-card"
          >
            <el-row>
              <el-text size="small" :type="runtimeContext.currentAccount?.steamid === acc.steamid?'primary':'default'">
                {{ acc.account_name + '\t\t' + acc.steamid }}
              </el-text>
            </el-row>
          </el-card>
        </div>
      </div>
      <el-divider class="custom-divider"/>

      <!-- 区域 5: 底部过滤器 -->
      <div class="section">
        <el-input v-model="currentData.filterText" size="small">
          <template #prefix>Filter:</template>
        </el-input>
      </div>
    </el-main>
    <el-footer>
      <el-row justify="space-between" align="middle" style="height: 100%; padding: 0 5px;">
        <el-text size="small">Check for updates</el-text>
        <el-text size="small">v1.0.15</el-text>
      </el-row>
    </el-footer>
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

/* 布局样式 */
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.el-empty {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>

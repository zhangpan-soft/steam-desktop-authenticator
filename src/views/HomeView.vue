<script setup lang="ts">
import {onMounted, onUnmounted, reactive} from 'vue'
import {ElMessage} from "element-plus";

type CurrentDataType = {
  filterText: string,
  currentAccount: SteamAccount,
  token: string,
  progress: number,
  entries: EntryType[],
}

const currentData = reactive<CurrentDataType>({
  filterText: '',
  token: '',
  progress: 0,
  entries:[],
  currentAccount: {
    shared_secret: '',
    serial_number: '',
    revocation_code: '',
    uri: '',
    server_time: '',
    account_name: '',
    token_gid: '',
    identity_secret: '',
    secret_1: '',
    status: 0,
    device_id: '',
    fully_enrolled: false,
    steamid: '',
  },
})

const tokenInterval = setInterval(()=>{
  if (!currentData.currentAccount || !currentData.currentAccount.account_name) {
    return
  }
  window.ipcRenderer.invoke('steam:token',{account_name: currentData.currentAccount?.account_name})
      .then((res:any)=>{
        currentData.token = res.token || ''
        currentData.progress = res.progress || 0
      })
}, 1000)


function handleExit() {
  window.ipcRenderer.invoke('close-window',{ hash: '/'}).then()
}

function handleViewConfirmations() {
  if (!currentData.currentAccount) {
    ElMessage.error('Please select one account')
  }
  window.ipcRenderer.invoke('open-window', {
    uri: {
      hash: '/steam/confirmations',
      query: {
        account_name: currentData.currentAccount.account_name
      }
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
  }).then()
}

function copyToken() {
  if (currentData.token) {
    navigator.clipboard.writeText(currentData.token).then(() => {
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
  window.ipcRenderer.invoke('context:get',)
      .then((context: RuntimeContext) => window.ipcRenderer.invoke('steam:account:get', {
        account_name: acc.account_name,
        passkey: context.passkey
      }).then((data: SteamAccount) => {
        currentData.currentAccount = {...data}
      }))

}

function handleSetupNewAccount() {
  window.ipcRenderer.invoke('open-window', {
    uri: {
      hash: '/steam/steamLogin',
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

function handleSettings(){
  window.ipcRenderer.invoke('open-window', {
    uri: {
      hash: '/system/settings'
    },
    options: {
      width: 420,
      height: 400,
      resizable: false,
      title: 'Settings',
      modal: true,
      show: false,
      icon: 'electron-vite.svg',
    }
  })
}

function handleImportAccount(){
  window.ipcRenderer.invoke('open-window', {
    uri: {
      hash: '/steam/importSda'
    },
    options: {
      width: 420,
      height: 500,
      resizable: false,
      title: 'Import Account',
      modal: true,
      show: false,
      icon: 'electron-vite.svg',
    }
  })
}

onMounted(() => {
  window.ipcRenderer.invoke('settings:get',)
      .then(settings=>{
        console.log('settings',settings)
        if (!settings.first_run){
          currentData.entries = {...settings.entries}
          return
        }
        window.ipcRenderer.invoke('open-window',{
          uri: {
            hash: '/system/initializing',
          },
          options: {
            width: 420,
            height: 300,
            resizable: false,
            title: 'Initializing',
            modal: true,
            show: false,
            icon: 'electron-vite.svg',
          }
        })
      })
})

onUnmounted(()=>{
  clearInterval(tokenInterval)
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
                @click="handleImportAccount">
              Import Account
            </el-dropdown-item>
            <el-dropdown-item @click="handleSettings">Settings</el-dropdown-item>
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
            v-model="currentData.token"
            readonly
            class="token-input"
            size="small"
        >
          <template #suffix>
            <el-button type="primary" link @click="copyToken">Copy</el-button>
          </template>
        </el-input>
        <el-progress :percentage="currentData.progress"
                     :show-text="false"
                     :indeterminate="false"
                     :status="currentData.progress>50? 'success': currentData.progress>30?'warning':'exception'"
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
        <el-empty class="el-empty" v-if="currentData.entries.length===0" description="No accounts loaded"/>
        <div v-else class="list-container">
          <el-card
              v-for="acc in currentData.entries"
              :key="acc.steamid"
              @click="selectAccount(acc)"
              class="list-item-card"
          >
            <el-row>
              <el-text size="small" :type="currentData.currentAccount.account_name == acc.account_name?'primary':'default'">
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

</template>

<style scoped>
/* 覆盖 Token 输入框样式 */
.token-input .el-input__wrapper {
  box-shadow: 0 0 0 1px #dcdfe6 inset !important;
  font-family: monospace;
  font-size: 18px;
  font-weight: bold;
  color: #409EFF;
}
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

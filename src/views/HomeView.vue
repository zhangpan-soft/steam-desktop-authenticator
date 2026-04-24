<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {onMounted, onUnmounted, reactive} from 'vue'
import Passkey from "../components/Passkey.vue";
import Initializing from "../components/Initializing.vue";
import HeaderMenu from "../components/HeaderMenu.vue";
import SetupNewAccount from "../components/SetupNewAccount.vue";
import SetupEncryption from "../components/SetupEncryption.vue";
import SteamToken from "../components/SteamToken.vue";
import ViewConfirmations from "../components/ViewConfirmations.vue";
import SteamAccountList from "../components/SteamAccountList.vue";
import pkg from '../../package.json';

type CurrentDataType = {
  account: EntryType,
  passkeyModel: boolean
  initializingModel: boolean
}

const { t } = useI18n()

const currentData = reactive<CurrentDataType>({
  passkeyModel: false,
  initializingModel: false,
  account: {
    account_name: '',
    steamid: '',
  }
})

const selectAccount = async (acc: EntryType) => {
  const selectedAccount = {
    account_name: acc.account_name,
    steamid: acc.steamid,
  }
  currentData.account = {...selectedAccount}
  await window.ipcRenderer.invoke('context:set', {selectedAccount})
}

onMounted(async () => {
  const settings: Settings = await window.ipcRenderer.invoke('settings:get',)
  const context: RuntimeContext = await window.ipcRenderer.invoke('context:get')
  if (context.selectedAccount) {
    const selectedAccount = settings.entries.find(entry =>
        entry.account_name === context.selectedAccount?.account_name &&
        entry.steamid === context.selectedAccount?.steamid)
    if (selectedAccount) {
      currentData.account = {...selectedAccount}
    }
  }
  if (settings.first_run) {
    currentData.initializingModel = true
  } else {
    if (settings.encrypted) {
      currentData.passkeyModel = true
    }
  }
})

onUnmounted(() => {
})

</script>

<template>
  <el-container class="container">
    <!--  顶部菜单  -->
    <el-header>
      <HeaderMenu :account_name="currentData.account.account_name" />
    </el-header>
    <el-main>
      <!-- 区域 1: 按钮组 -->
      <div class="section">
        <el-button-group size="small" class="full-width-group">
          <SetupNewAccount />
          <SetupEncryption />
        </el-button-group>
      </div>
      <el-divider class="custom-divider"/>

      <!-- 区域 2: Token -->
      <div class="section">
        <SteamToken :account_name="currentData.account.account_name" />
      </div>
      <el-divider class="custom-divider"/>

      <!-- 区域 3: View Confirmations -->
      <div class="section">
        <ViewConfirmations :account_name="currentData.account.account_name" />
      </div>
      <el-divider class="custom-divider"/>

      <!-- 区域 4: 账号列表 (自适应高度) -->
      <SteamAccountList @selected="selectAccount"/>
    </el-main>
    <el-footer>
      <el-row justify="space-between" align="middle" style="height: 100%; padding: 0 5px;">
        <el-text size="small">{{ t('home.checkForUpdates') }}</el-text>
        <el-text size="small">v{{ pkg.version }}</el-text>
      </el-row>
    </el-footer>
  </el-container>

  <Passkey v-if="currentData.passkeyModel" v-model:show="currentData.passkeyModel"
           :show-cancel-button="false"/>

  <Initializing v-if="currentData.initializingModel" v-model:show="currentData.initializingModel"/>

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

/* 顶部按钮 */
.full-width-group {
  display: flex;
  width: 100%;
}

.full-width-group :deep(.el-button) {
  flex: 1;
}

.form-row label {
  display: block;
  font-size: 13px;
  color: #333;
  margin-bottom: 4px;
}

/* 布局样式 */
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

</style>

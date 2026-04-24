<script setup lang="ts">

import {reactive, ref} from "vue";
import ImportAccount from "./ImportAccount.vue";
import ExportAccounts from "./ExportAccounts.vue";
import Settings from "./Settings.vue";
import {ElMessage} from "element-plus";
import SteamLogin from "./SteamLogin.vue";
import { useI18n } from 'vue-i18n'
import { ArrowRight } from "@element-plus/icons-vue";

const props = withDefaults(defineProps<{
  account_name?: string
}>(),{})

const currentData = reactive<{
  settingsModel: boolean
  importAccountModel: boolean
  exportAccountModel: boolean
  loginModelShow: boolean
  steamLoginRef: any
}>({
  settingsModel: false,
  importAccountModel: false,
  exportAccountModel: false,
  loginModelShow: false,
  steamLoginRef: ref<InstanceType<typeof SteamLogin>>()
})

const { t, locale } = useI18n()

const handleSettings = () => {
  currentData.settingsModel = true
}

const handleImportAccount = () => {
  currentData.importAccountModel = true
}

const handleExportAccounts = () => {
  currentData.exportAccountModel = true
}

const handleExit = async () => {
  await window.ipcRenderer.invoke('close-window', {hash: '/'})
}
const handleNotifications = async () => {
  if (!props.account_name) {
    ElMessage.warning({
      message: t('home.noAccountSelected'),
      grouping: true,
      showClose: true,
      duration: 3000
    })
    return
  }
  await window.ipcRenderer.invoke('steam:open-notifications', { account_name: props.account_name })
}

const handleInventory = async ()=>{
  if (!props.account_name) {
    ElMessage.warning({
      message: t('home.noAccountSelected'),
      grouping: true,
      showClose: true,
      duration: 3000
    })
    return
  }
  await window.ipcRenderer.invoke('steam:open-community-window', { account_name: props.account_name, url: 'https://steamcommunity.com/profiles/%s%/inventory'})
}

const handleCs2Inventory = async () => {
  if (!props.account_name) {
    ElMessage.warning({
      message: t('home.noAccountSelected'),
      grouping: true,
      showClose: true,
      duration: 3000
    })
    return
  }
  await window.ipcRenderer.invoke('open-window', {
    uri: {
      hash: '/steam/cs2-inventory',
      query: {
        account_name: props.account_name
      }
    },
    options: {
      width: 1100,
      height: 800,
      minWidth: 960,
      minHeight: 720,
      useContentSize: true,
      resizable: true,
      maximizable: true,
      minimizable: true,
      show: false,
      icon: 'icon.png',
      title: t('cs2Inventory.title')
    }
  })
}

const handleTrade = async ()=>{
  if (!props.account_name) {
    ElMessage.warning({
      message: t('home.noAccountSelected'),
      grouping: true,
      showClose: true,
      duration: 3000
    })
    return
  }
  await window.ipcRenderer.invoke('steam:open-community-window', { account_name: props.account_name, url: 'https://steamcommunity.com/profiles/%s%/tradeoffers/'})
}

const handleLoginAgain = async ()=>{
  if (!props.account_name){
    ElMessage.warning({
      message: t('home.noAccountSelected'),
      grouping: true,
      showClose: true,
      duration: 3000
    })
    return
  }
  currentData.loginModelShow = true
}
const handleLoginSuccess = async (session:SteamSession)=>{
}
const handleLoginFailed = async (err:any)=>{
  ElMessage.error(err.message)
}
const handleForceRefresh = async ()=>{
  if (!props.account_name){
    ElMessage.warning({
      message: t('home.noAccountSelected'),
      grouping: true,
      showClose: true,
      duration: 3000
    })
    return
  }
  const refreshResult = await window.ipcRenderer.invoke('steam:RefreshLogin',{account_name: props.account_name})
  if (refreshResult){
    ElMessage.success(t('home.refreshSuccess'))
  } else {
    ElMessage.error(t('home.refreshFailed'))
  }
}
const handleRemove = async ()=>{
  if (!props.account_name){
    ElMessage.warning({
      message: t('home.noAccountSelected'),
      grouping: true,
      showClose: true,
      duration: 3000
    })
    return
  }
  const settings = await window.ipcRenderer.invoke('settings:get')
  const index = settings.entries.findIndex((entry:any) => entry.account_name === props.account_name)
  if (index!==-1){
    settings.entries.splice(index,1)
    await window.ipcRenderer.invoke('settings:set', settings)
    await window.ipcRenderer.invoke('context:set', {
      selectedAccount: settings.entries[0] || null
    })
  }
}

const switchLanguage = async (lang: 'en' | 'zh') => {
  locale.value = lang;
  const settings = await window.ipcRenderer.invoke('settings:get');
  await window.ipcRenderer.invoke('settings:set', { ...settings, language: lang });
}
</script>


<template>
  <el-row justify="space-between" align="middle" style="height: 100%; padding: 0 5px;">
    <div>
      <el-dropdown trigger="click" size="small" class="menu-dropdown">
        <span class="menu-item-text">{{ t('header.file') }}</span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="handleImportAccount">
              {{ t('header.importAccount') }}
            </el-dropdown-item>
            <el-dropdown-item @click="handleExportAccounts">
              {{ t('header.exportAccounts') }}
            </el-dropdown-item>
            <el-dropdown-item @click="handleSettings">{{ t('header.settings') }}</el-dropdown-item>
            <el-dropdown-item divided>
              <el-dropdown placement="right-start" class="language-dropdown" size="small">
                  <span class="submenu-trigger">
                    <span>{{ t('header.language') }}</span>
                    <el-icon><ArrowRight/></el-icon>
                 </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="switchLanguage('en')">{{t('header.en')}}</el-dropdown-item>
                    <el-dropdown-item @click="switchLanguage('zh')">{{t('header.zh')}}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-dropdown-item>
            <el-dropdown-item divided @click="handleExit">{{ t('header.exit') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-dropdown trigger="click" size="small" class="menu-dropdown">
        <span class="menu-item-text">{{ t('header.selectedAccount') }}</span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="handleNotifications">{{ t('header.notifications') }}</el-dropdown-item>
            <el-dropdown-item @click="handleInventory">{{ t('header.inventory') }}</el-dropdown-item>
            <el-dropdown-item @click="handleCs2Inventory">{{ t('header.cs2Inventory') }}</el-dropdown-item>
            <el-dropdown-item @click="handleTrade">{{ t('header.trade') }}</el-dropdown-item>
            <el-dropdown-item @click="handleLoginAgain">{{ t('header.loginAgain') }}</el-dropdown-item>
            <el-dropdown-item @click="handleForceRefresh">{{ t('header.forceRefresh') }}</el-dropdown-item>
            <el-dropdown-item divided @click="handleRemove">{{ t('header.remove') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <el-text truncated size="small" style="max-width: 150px;">{{ props.account_name }}</el-text>
  </el-row>

  <ImportAccount v-if="currentData.importAccountModel" v-model:show="currentData.importAccountModel"/>
  <ExportAccounts
      v-if="currentData.exportAccountModel"
      v-model:show="currentData.exportAccountModel"
      :account_name="props.account_name"
  />
  <Settings v-if="currentData.settingsModel" v-model:show="currentData.settingsModel"/>
  <SteamLogin
      v-if="currentData.loginModelShow"
      :ref="currentData.steamLoginRef"
      :account_name="props.account_name"
      v-model:show="currentData.loginModelShow"
      @success="handleLoginSuccess"
      @failed="handleLoginFailed"
  />
</template>

<style scoped>
/* 菜单栏 */
.menu-dropdown {
  margin-right: 10px;
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
/* 消除 el-dropdown 包装层对排版的影响 */
.language-dropdown {
  width: 100%;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
}

.submenu-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  outline: none; /* 移除点击时的焦点外边框 */
  color: inherit; /* 完美继承父级的悬停颜色 */
  font-family: inherit;
  font-weight: inherit;
}
</style>

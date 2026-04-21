<script setup lang="ts">

import {reactive, ref} from "vue";
import ImportAccount from "./ImportAccount.vue";
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
  loginModelShow: boolean
  steamLoginRef: any
}>({
  settingsModel: false,
  importAccountModel: false,
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
  console.log(session)
}
const handleLoginFailed = async (err:any)=>{
  console.log(err)
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
  await window.ipcRenderer.invoke('settings:get',)
      .then((settings)=>{
        const index = settings.entries.findIndex((entry:any) => entry.account_name === props.account_name)
        if (index!==-1){
          settings.entries.splice(index,1)
          return window.ipcRenderer.invoke('settings:set', settings)
        }
      })
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
            <el-dropdown-item @click="handleSettings">{{ t('header.settings') }}</el-dropdown-item>
            <el-dropdown-item divided>
              <el-dropdown placement="right-start" class="language-dropdown" size="small">
                  <span class="submenu-trigger">
                    <span>{{ t('header.language') }}</span>
                    <el-icon><ArrowRight/></el-icon>
                 </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="switchLanguage('en')">English</el-dropdown-item>
                    <el-dropdown-item @click="switchLanguage('zh')">中文</el-dropdown-item>
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

<script setup lang="ts">

import {reactive} from "vue";
import ImportAccount from "./ImportAccount.vue";
import Settings from "./Settings.vue";
import {ElMessage} from "element-plus";
import SteamLogin from "./SteamLogin.vue";

const props = withDefaults(defineProps<{
  account_name?: string
}>(),{})

const currentData = reactive<{
  settingsModel: boolean
  importAccountModel: boolean
  loginModelShow: boolean
}>({
  settingsModel: false,
  importAccountModel: false,
  loginModelShow: false,
})

const handleSettings = () => {
  currentData.settingsModel = true
}

const handleImportAccount = () => {
  currentData.importAccountModel = true
}

const handleExit = async () => {
  await window.ipcRenderer.invoke('close-window', {hash: '/'})
}
const handleLoginAgain = async ()=>{
  if (!props.account_name){
    ElMessage.warning('No account by selected')
    return
  }
}
const handleLoginSuccess = async (session:SteamSession)=>{
  console.log(session)
  const steamAccount = await window.ipcRenderer.invoke('steam:account:get', {account_name: props.account_name})
  steamAccount.Session = {...session}
  await window.ipcRenderer.invoke('steam:account:set', {...steamAccount})
}
const handleLoginFailed = async (err:any)=>{
  console.log(err)
  ElMessage.error(err.message)
}
const handleForceRefresh = async ()=>{
  if (!props.account_name){
    ElMessage.warning('No account by selected')
    return
  }
  const refreshResult = await window.ipcRenderer.invoke('steam:RefreshLogin',{account_name: props.account_name})
  if (refreshResult){
    ElMessage.success(`Refresh success`)
  } else {
    ElMessage.error(`Refresh failed`)
  }
}
const handleRemove = async ()=>{
  if (!props.account_name){
    ElMessage.warning('No account by selected')
    return
  }
  await window.ipcRenderer.invoke('settings:get',)
      .then((settings)=>{
        const index = settings.entries.findIndex((entry:any)=>{entry.account_name === props.account_name})
        if (index!==-1){
          settings.entries.splice(index,1)
          return window.ipcRenderer.invoke('settings:set', settings)
        }
      })
}
</script>


<template>
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
        <el-dropdown-item @click="handleLoginAgain">Login again</el-dropdown-item>
        <el-dropdown-item @click="handleForceRefresh">Force refresh</el-dropdown-item>
        <el-dropdown-item divided @click="handleRemove">Remove</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>

  <ImportAccount v-if="currentData.importAccountModel" v-model:show="currentData.importAccountModel"/>
  <Settings v-if="currentData.settingsModel" v-model:show="currentData.settingsModel"/>
  <SteamLogin
      v-if="currentData.loginModelShow"
      ref="steamLoginRef"
      :account_name="props.account_name"
      v-model:show="currentData.loginModelShow"
      @success="handleLoginSuccess"
      @failed="handleLoginFailed"
  />
</template>

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
</style>

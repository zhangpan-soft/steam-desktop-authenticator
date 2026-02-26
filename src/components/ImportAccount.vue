<script setup lang="ts">
import {reactive, ref} from "vue";
import SteamLogin from "./SteamLogin.vue";
import CustomDialog from "./CustomDialog.vue";
import {Hide, Lock, Unlock, View} from "@element-plus/icons-vue";
import {ElMessage} from "element-plus";

const currentData = reactive<{
  passkey: string
  locked: boolean
  old: boolean
  loading: boolean
  loginModelShow: boolean
  steamAccount: SteamAccount
}>({
  passkey: '',
  locked: true,
  old: false,
  loading: false,
  loginModelShow: false,
  steamAccount: {} as SteamAccount
})

const show = defineModel<boolean>('show', { default: false })

const steamLoginRef = ref<InstanceType<typeof SteamLogin>>()

const events = {
  async handleLoginSuccess(session: SteamSession){
    currentData.steamAccount.Session = session
    await window.ipcRenderer.invoke('steam:account:set', currentData.steamAccount)
    const settings:Settings = await window.ipcRenderer.invoke('settings:get')
    const index = settings.entries.findIndex(item=> item.account_name === currentData.steamAccount.account_name)
    if (index===-1){
      settings.entries.push({steamid: currentData.steamAccount.Session.SteamID, account_name: currentData.steamAccount.account_name})
    }
    await window.ipcRenderer.invoke('settings:set', settings)
  },
  handleLoginFailed(err: any){
    console.log(err)
    ElMessage.error('Import Failed')
    show.value = false
    currentData.loginModelShow = false
  },
  handleCancel(){
    show.value = false
    currentData.loading = false
  },
  async handleConfirm() {
    currentData.loading = true;
      try {
        const selectFileRes = await window.ipcRenderer.invoke('showOpenDialog', {
          properties: ['openFile'],
          filters: [{ name: '.maFile', extensions: ['maFile', 'json', 'text'] }]
        })

        // 修正逻辑：如果用户取消了对话框
        if (selectFileRes.canceled) {
          ElMessage.warning('You canceled')
          return
        }

        const filePath = selectFileRes.filePaths[0]
        if (!filePath) {
          ElMessage.warning('No file paths found.')
          return
        }

        let steamAccount: SteamAccount;

        if (currentData.old) {
          const importMaFileRes = await window.ipcRenderer.invoke('importMaFile', {
            path: filePath,
            passkey: currentData.passkey,
          })
          steamAccount = importMaFileRes.data as SteamAccount
        } else {
          // 统一使用 await 替代 .then
          const res = await window.ipcRenderer.invoke('steam:account:get', {
            filepath: filePath,
            passkey: currentData.passkey,
          })
          steamAccount = res as SteamAccount
        }
        currentData.steamAccount = steamAccount
        currentData.loginModelShow = true
      } catch (e: any) {
        ElMessage.error(e.message || 'Unknown Error')
      } finally {
        // 无论成功失败，闭包执行完毕后关闭 Loading
        currentData.loading = false
      }
  }
}
</script>

<template>
  <CustomDialog :title="'Import Account'"
                :loading="currentData.loading"
                v-model:show="show"
                @cancel="events.handleCancel"
                @confirm="events.handleConfirm">
    <el-row>
      <el-text size="small">
        Enter your encryption passkey if your .maFile is encrypted:
      </el-text>
    </el-row>
    <el-row>
      <el-input v-model="currentData.passkey" placeholder="" size="small" :type="currentData.locked ? 'password' : 'text'">
        <template #prefix>
          <el-icon>
            <component :is="currentData.locked ? Lock : Unlock"/>
          </el-icon>
        </template>
        <template #suffix>
          <el-icon
              style="cursor: pointer;"
              @click="currentData.locked = !currentData.locked"
          >
            <component :is="currentData.locked ? Hide : View"/>
          </el-icon>
        </template>
      </el-input>
    </el-row>
    <el-row>
      <el-switch size="small" v-model="currentData.old"/>
      <el-text size="small">
        If your maFile from old brand, You need to turn on this switch
      </el-text>
    </el-row>
    <el-row>
      <el-text size="small">
        If you import an encrypted .maFile, the manifest file must be next to it.
      </el-text>
    </el-row>
  </CustomDialog>
  <SteamLogin
      v-if="currentData.loginModelShow"
      ref="steamLoginRef"
      :account_name="currentData.steamAccount.account_name"
      :shared_secret="currentData.steamAccount.shared_secret"
      v-model:show="currentData.loginModelShow"
      @success="events.handleLoginSuccess"
      @failed="events.handleLoginFailed"
  />
</template>

<style scoped>

</style>

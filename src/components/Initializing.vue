<script setup lang="ts">

import CustomDialog from "./CustomDialog.vue";
import {ElMessage} from "element-plus";
import { useI18n } from 'vue-i18n'
import {ref} from "vue";

const show = defineModel<boolean>('show', {default: false})
const loading = ref(false)
const { t } = useI18n()

const events = {
  async handleDefault(){
    loading.value = true
    try {
      await window.ipcRenderer.invoke('settings:set', {first_run: false})
      show.value = false
    } finally {
      loading.value = false
    }
  },
  async handleCustom(){
    loading.value = true
    try {
      const res = await window.ipcRenderer.invoke('showOpenDialog', {
        properties: ['openDirectory']
      })
      if (res.canceled) {
        ElMessage.warning(t('initializing.canceled'))
        return
      }
      const filepath = res.filePaths[0]
      await window.ipcRenderer.invoke('settings:set', {maFilesDir: filepath, first_run: false})
      ElMessage.success(t('initializing.success'))
      show.value = false
    } finally {
      loading.value = false
    }
  }
}
</script>

<template>
  <CustomDialog :title="t('initializing.title')"
                :loading="loading"
                v-model:show="show"
                :show-cancel-button="false"
                :show-confirm-button="false">
    <el-row>
      <el-text type="info" size="small">
        {{ t('initializing.selectMaFilesFolder') }}
      </el-text>
    </el-row>
    <el-row>
      <el-button type="default" style="width: 100%" @click="events.handleDefault">{{ t('initializing.default') }}</el-button>
    </el-row>
    <el-row>
      <el-button type="default" style="width: 100%" @click="events.handleCustom">{{ t('initializing.custom') }}</el-button>
    </el-row>
  </CustomDialog>
</template>

<style scoped>

</style>

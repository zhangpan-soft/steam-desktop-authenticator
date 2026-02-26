<script setup lang="ts">

import CustomDialog from "./CustomDialog.vue";
import {reactive} from "vue";
import {ElMessage} from "element-plus";
import {Hide, Lock, Unlock, View} from "@element-plus/icons-vue";

const show = defineModel<boolean>('show', {default: false})

withDefaults(defineProps<{
  showCancelButton?: boolean
}>(), {showCancelButton: false})

const currentData = reactive<{
  passkey: string
  loading: boolean
  locked: boolean
}>({
  passkey: '',
  loading: false,
  locked: true
})

const events = {
  async handleConfirm() {
    try {
      await window.ipcRenderer.invoke('context:set', {passkey: currentData.passkey})
      show.value = false
    } catch (e: any) {
      ElMessage.error(e.message)
    }
  },
  handleCancel() {
    show.value = false
  }
}

</script>

<template>
  <CustomDialog :title="'Passkey'"
                :loading="currentData.loading"
                v-model:show="show"
                :show-cancel-button="showCancelButton"
                :show-confirm-button="true"
                @confirm="events.handleConfirm"
                @cancel="events.handleCancel"
  >
    <el-input size="small" :type="currentData.locked ? 'password' : 'text'" v-model="currentData.passkey"
              placeholder="Please Input SDA Passkey">
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
  </CustomDialog>
</template>

<style scoped>

</style>

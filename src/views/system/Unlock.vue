<script setup lang="ts">
import {reactive} from "vue";
import Dialog from "../../components/Dialog.vue";
import {ElMessage} from "element-plus";

const currentData = reactive<{
  passkey: string
}>({
  passkey: ''
})

function handleConfirm(){
  window.ipcRenderer.invoke('context:set',{passkey: currentData.passkey}).then(()=>{
    ElMessage.success('Success')
  }).catch(()=>{
    ElMessage.error('Failed')
  })
}
</script>

<template>
  <Dialog :title="'Passkey'"
          :show-cancel-button="false"
          :show-confirm-button="false">
    <el-input v-model="currentData.passkey" placeholder="Please Input SDA Passkey">
      <template #append @click="handleConfirm">确定</template>
    </el-input>
  </Dialog>
</template>

<style scoped>

</style>

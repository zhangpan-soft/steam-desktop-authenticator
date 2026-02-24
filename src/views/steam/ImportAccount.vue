<script setup lang="ts">
import {reactive} from "vue";
import Dialog from "../../components/Dialog.vue";

const currentData = reactive<{
  passkey: string
}>({
  passkey: ''
})

function handleCancel(){
  window.ipcRenderer.invoke('close-window',{
    hash: '/steam/importAccount'
  })
}

function handleConfirm(){

}
</script>

<template>
  <Dialog @cancel="handleCancel" @confirm="handleConfirm" :title="'Import Account'">
    <el-row>
      <el-text size="small">
        Enter your encryption passkey if your .maFile is encrypted:
      </el-text>
    </el-row>
    <el-row>
      <el-input v-model="currentData.passkey" placeholder="" size="small"/>
    </el-row>
    <el-row>
      <el-text size="small">
        If you import an encrypted .maFile, the manifest file must be next to it.
      </el-text>
    </el-row>
  </Dialog>
</template>

<style scoped>
.import-account{
  --el-card-padding: 5px;
  height: 100%;
}
</style>

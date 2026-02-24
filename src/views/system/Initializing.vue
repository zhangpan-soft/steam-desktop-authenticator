<script setup lang="ts">
import Dialog from "../../components/Dialog.vue";
import {ElMessage} from "element-plus";

function initialSelect(type: number){
  if (type === 1){
    return
  }
  if (type === 2){
    window.ipcRenderer.invoke('showOpenDialog',{
      properties: ['openDirectory']
    }).then((res:any)=>{
      if (res.canceled){
        ElMessage.warning('Canceled')
        return
      }
      const filepath = res.filePaths[0]
      window.ipcRenderer.invoke('settings:set',{maFilesDir: filepath})
          .then(()=>{
            ElMessage.success('Success')
          })
    })
  }
}
</script>

<template>
  <Dialog :title="'Initializing'"
          :show-confirm-button="false"
          :show-cancel-button="false"
  >
    <el-row>
      <el-text type="info" size="small">
        Please Select the MaFiles Folder
      </el-text>
    </el-row>
    <el-row>
      <el-button type="default" style="width: 100%" @click="initialSelect(1)">Default</el-button>
    </el-row>
    <el-row>
      <el-button type="default" style="width: 100%" @click="initialSelect(2)">Custom</el-button>
    </el-row>
  </Dialog>
</template>

<style scoped>

</style>

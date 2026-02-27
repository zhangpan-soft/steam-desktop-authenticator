<script setup lang="ts">
import {onUnmounted, reactive} from "vue";
import {ElMessage} from "element-plus";

const props = withDefaults(defineProps<{
  account_name?: string
}>(),{})

const currentData = reactive<{
  token: string
  progress: number
}>({
  token: 'N/A',
  progress: 0
})

const copyToken = () => {
  if (currentData.token) {
    navigator.clipboard.writeText(currentData.token).then(() => {
      ElMessage.success('Token copied to clipboard')
    }).catch(() => {
      ElMessage.error('Failed to copy token')
    })
  } else {
    ElMessage.warning('No token to copy')
  }
}
const tokenInterval = setInterval(async () => {
  if (!props.account_name) {
    return
  }
  const res = await window.ipcRenderer.invoke('steam:token', {account_name: props.account_name})
  currentData.token = res.token || ''
  currentData.progress = res.progress || 0
}, 1000)

onUnmounted(()=>{
  clearInterval(tokenInterval)
})
</script>

<template>
  <el-input
      v-model="currentData.token"
      readonly
      class="token-input"
      size="small"
  >
    <template #suffix>
      <el-button type="primary" link @click="copyToken">Copy</el-button>
    </template>
  </el-input>
  <el-progress :percentage="currentData.progress"
               :show-text="false"
               :indeterminate="false"
               :status="currentData.progress>50? 'success': currentData.progress>30?'warning':'exception'"
               :text-inside="true"/>
</template>

<style scoped>

</style>

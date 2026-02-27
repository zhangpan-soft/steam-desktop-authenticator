<script setup lang="ts">
import {ElMessage} from "element-plus";
import {ref} from "vue";

const props = withDefaults(defineProps<{
  account_name?: string
}>(),{})

const loading = ref(false)

const handleViewConfirmations = async () => {
  if (!props.account_name) {
    ElMessage.error('Please select one account')
    return
  }
  loading.value = true
  try {
    await window.ipcRenderer.invoke('open-window', {
      uri: {
        hash: '/steam/confirmations',
        query: {
          account_name: props.account_name
        }
      },
      options: {
        width: 600,   // 改窄，模仿手机/工具宽度
        height: 800,  // 高度适中
        useContentSize: true, // 确保内容区域有这么大
        resizable: false, // 允许调整，但你可以设为 false 固定大小
        minWidth: 600,   // 限制最小宽度
        minHeight: 800,
        maximizable: false,
        minimizable: false,
        show: false,
        icon: 'icon.png',
        x: screen.width / 2 + 210,
        y: screen.height / 2 - 400,
        title: 'Confirmations'
      }
    })
  } finally {
    loading.value = false
  }
}

</script>

<template>
  <el-button :loading="loading" type="default" size="small" class="full-width-btn" @click="handleViewConfirmations">
    View Confirmations
  </el-button>
</template>

<style scoped>
.full-width-btn {
  width: 100%;
}
</style>

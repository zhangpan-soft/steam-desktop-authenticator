<script setup lang="ts">

// 1. 优雅的显示状态控制
const show = defineModel<boolean>('show', {default: false})

// 2. 属性定义
withDefaults(defineProps<{
  loading?: boolean
  title?: string
  cancelButtonText?: string
  confirmButtonText?: string
  showCancelButton?: boolean
  showConfirmButton?: boolean
}>(), {
  loading: false,
  cancelButtonText: 'Cancel',
  confirmButtonText: 'Confirm',
  showCancelButton: true,
  showConfirmButton: true
})

// 3. 事件定义
const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

const events = {
  onCancel() {
    show.value = false
    emit('cancel')
  },
  onConfirm() {
    emit('confirm')
  }
}
</script>

<template>
  <el-dialog
      v-model="show"
      v-loading="loading"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :destroy-on-close="true"
      :align-center="true"
      width="100%"
  >
    <template #header v-if="title">
      <el-row justify="center" align="middle">
        <el-text size="large" style="font-weight: bold">{{ title }}</el-text>
      </el-row>
    </template>

    <slot/>

    <template #footer>
      <el-row justify="end" align="middle">
        <el-button v-if="showCancelButton" size="small" @click="events.onCancel" type="default">{{ cancelButtonText }}
        </el-button>
        <el-button v-if="showConfirmButton" size="small" type="default" @click="events.onConfirm">{{ confirmButtonText }}
        </el-button>
      </el-row>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">

import type { Component } from 'vue'
// 1. 优雅的显示状态控制
const show = defineModel<boolean>('show', {default: false})
import {ElementLoadingSvg} from "../utils/icons.ts";

// 2. 属性定义
withDefaults(defineProps<{
  loading?: boolean
  title?: string
  icon?: Component
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
      class="custom-dialog-border"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :destroy-on-close="true"
      :align-center="true"
      width="100%"
  >
    <template #header v-if="title">
      <el-row justify="center" align="middle">
        <el-icon v-if="icon" style="margin-right: 5px" size="20">
          <component :is="icon"/>
        </el-icon>
        <el-text size="large" style="font-weight: bold">{{ title }}</el-text>
      </el-row>
    </template>

    <div
        v-loading="loading"
        :element-loading-svg="ElementLoadingSvg"
        element-loading-svg-view-box="0, 0, 24, 24"
    >
      <slot/>
    </div>

    <template #footer>
      <el-row justify="end" align="middle">
        <el-button v-if="showCancelButton" :disabled="loading" size="small" @click="events.onCancel" type="default">{{ cancelButtonText }}
        </el-button>
        <el-button v-if="showConfirmButton" :disabled="loading" size="small" type="default" @click="events.onConfirm">{{ confirmButtonText }}
        </el-button>
      </el-row>
    </template>
  </el-dialog>
</template>

<style>
.custom-dialog-border .el-dialog__header {
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.custom-dialog-border .el-dialog__footer {
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>

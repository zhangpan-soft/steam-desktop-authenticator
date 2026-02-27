<script setup lang="ts">
/**
 * Dialog 组件
 * 作为一个通用的弹窗外壳，负责布局(Header/Footer)和加载状态
 * 中间的内容通过 <slot> 由父组件传入
 */
import {ElementLoadingSvg} from "../utils/icons.ts";
defineProps({
  title: {
    type: String,
    default: ''
  },
  cancelButtonText: {
    type: String,
    default: 'Cancel'
  },
  confirmButtonText: {
    type: String,
    default: 'Confirm'
  },
  loading: {
    type: Boolean,
    default: false
  },
  showCancelButton: {
    type: Boolean,
    default: true
  },
  showConfirmButton: {
    type: Boolean,
    default: true
  }
})
defineEmits(['cancel', 'confirm'])
</script>

<template>
  <el-container
      v-loading="loading"
      :element-loading-svg="ElementLoadingSvg"
      element-loading-svg-view-box="0, 0, 24, 24"
      class="dialog-container"
  >
    <el-header class="header-center">
      <el-text size="large" class="title">
        {{ title }}
      </el-text>
    </el-header>

    <el-main class="dialog-content">
      <slot></slot>
    </el-main>

    <el-footer class="footer" v-if="showCancelButton || showConfirmButton">
      <el-row justify="center" align="middle">
        <el-button
            v-if="showCancelButton"
            type="default"
            size="small"
            @click="$emit('cancel')"
        >
          {{ cancelButtonText }}
        </el-button>
        <el-button
            v-if="showConfirmButton"
            type="default"
            size="small"
            @click="$emit('confirm')"
        >
          {{ confirmButtonText }}
        </el-button>
      </el-row>
    </el-footer>
  </el-container>
</template>

<style scoped>
.title {
  font-weight: bold;
}
.dialog-container {
  height: 100%;
  background-color: var(--el-bg-color); /* 保持背景色一致 */
}
.header-center {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 5px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.dialog-content {
  /* 可以根据需要添加一些默认内边距，或者留给父组件控制 */
  padding: 5px;
}
.footer{
  padding: 5px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>

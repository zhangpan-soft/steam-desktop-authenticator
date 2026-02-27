<script setup lang="ts">

import CustomDialog from "./CustomDialog.vue";
import {onMounted, reactive, toRaw} from "vue";
import {Setting} from '@element-plus/icons-vue'

const show = defineModel<boolean>('show', {default: false})
const currentData = reactive<{
  settings: Settings,
  loading: boolean
}>({
  settings: {} as Settings,
  loading: false
})

const events = {
  handleCancel() {
    show.value = false
  },
  async handleConfirm() {
    currentData.loading = true
    try {
      await window.ipcRenderer.invoke('settings:set', {...toRaw<Settings>(currentData.settings)})
      show.value = false
    } finally {
      currentData.loading = false
    }
  }
}

onMounted(async () => {
  const settings: Settings = await window.ipcRenderer.invoke('settings:get',)
  currentData.settings = {...settings}
})

</script>

<template>
  <CustomDialog v-model:show="show"
                :title="'Settings'"
                :icon="Setting"
                :loading="currentData.loading"
                @confirm="events.handleConfirm"
                @cancel="events.handleCancel"
                :confirm-button-text="'Save'"
  >
    <el-row justify="start" align="middle">
      <el-checkbox v-model="currentData.settings.periodic_checking" size="small"/>
      <el-text size="small" class="settings-text"
               @click="currentData.settings.periodic_checking = !currentData.settings.periodic_checking">
        Periodically check for new confirmations and show a popup when they arrive
      </el-text>
    </el-row>

    <el-row justify="start" align="middle" class="settings-row">
      <el-input
          v-model="currentData.settings.periodic_checking_interval"
          type="number"
          size="small"
          style="width: 50px; flex-shrink: 0;"
      />
      <el-text size="small" class="settings-text">
        Seconds between checking for confirmations
      </el-text>
    </el-row>

    <el-row justify="start" align="middle" class="settings-row">
      <el-checkbox v-model="currentData.settings.periodic_checking_checkall" size="small"/>
      <el-text size="small" class="settings-text"
               @click="currentData.settings.periodic_checking_checkall = !currentData.settings.periodic_checking_checkall">
        Check all accounts for confirmations
      </el-text>
    </el-row>

    <el-row justify="start" align="middle" class="settings-row">
      <el-checkbox v-model="currentData.settings.auto_confirm_market_transactions" size="small"/>
      <el-text size="small" class="settings-text"
               @click="currentData.settings.auto_confirm_market_transactions = !currentData.settings.auto_confirm_market_transactions">
        Auto-confirm market transactions
      </el-text>
    </el-row>

    <el-row justify="start" align="middle" class="settings-row">
      <el-checkbox v-model="currentData.settings.auto_confirm_trades" size="small"/>
      <el-text size="small" class="settings-text"
               @click="currentData.settings.auto_confirm_trades = !currentData.settings.auto_confirm_trades">
        Auto-confirm transactions
      </el-text>
    </el-row>
    <el-row style="margin-bottom: 12px">
      <el-text size="small">
        Please setting the httpProxy or socksProxy. If in China
      </el-text>
      <el-input v-model="currentData.settings.proxy" size="small"
                placeholder="http[s]|socks5://username@password:ip:port"></el-input>
    </el-row>
    <el-row justify="start" align="middle" class="settings-row">
      <el-input
          v-model="currentData.settings.timeout"
          type="number"
          size="small"
          style="width: 150px; flex-shrink: 0;"
      />
      <el-text size="small" class="settings-text">
        Timeout of requests in milliseconds
      </el-text>
    </el-row>
  </CustomDialog>
</template>

<style scoped>
/* 核心布局样式 */
.settings-row {
  display: flex; /* 启用 Flex 布局 */
  align-items: center; /* 垂直居中核心属性 */
  flex-wrap: nowrap; /* 禁止整个行换行 */
  width: 100%;
  padding: 2px;
}

.settings-text {
  flex: 1; /* 占满右侧剩余宽度 */
  margin-left: 10px; /* 左侧控件和文字的间距 */
  white-space: normal; /* 允许文字换行 (核心) */
  word-break: break-word; /* 防止长单词溢出 */
  line-height: 1.4; /* 增加行高，多行时更美观 */
  cursor: pointer; /* 鼠标变成手型，提示可点击 */
}
</style>

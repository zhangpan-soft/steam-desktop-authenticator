<script setup lang="ts">
import {onMounted, reactive, toRaw} from "vue";
import {ElMessage} from "element-plus";
import Dialog from "../../components/Dialog.vue";

const currentData = reactive<{
  settings: Settings,
  loading: boolean
}>({
  settings: {
    encrypted: false,
    first_run: true,
    periodic_checking: false,
    periodic_checking_interval: 60,
    periodic_checking_checkall: false,
    auto_confirm_market_transactions: false,
    auto_confirm_trades: false,
    maFilesDir: '',
    entries: [],
    proxy: '',
    timeout: 3000
  },
  loading: false
})

function handleCancel() {
  currentData.loading = true
  window.ipcRenderer.invoke('close-window', {
    hash: '/system/settings'
  }).finally(()=>currentData.loading = false);
}

function handleSave() {
  currentData.loading = true
  const _  = toRaw<Settings>(currentData.settings)
  const args = {..._}
  window.ipcRenderer.invoke('settings:set', args)
      .then(() => {
        ElMessage.success('Save Success')
      })
      .catch(() => {
        ElMessage.error('Save Failed')
      })
      .then(() => window.ipcRenderer.invoke('close-window', {hash: '/system/settings'}))
      .finally(()=>currentData.loading=false)
}

onMounted(() => {
  currentData.loading = true
  window.ipcRenderer.invoke('settings:get',).then((res: Settings) => {
    currentData.settings = {...res}
  }).finally(()=>{
    currentData.loading = false
  })
})
</script>

<template>
  <Dialog :title="'Settings'" @cancel="handleCancel" @confirm="handleSave" :loading="currentData.loading" :confirm-button-text="'Save'">
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
  </Dialog>
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

<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useRoute} from 'vue-router'
import {useI18n} from 'vue-i18n'
import {ElMessage} from 'element-plus'
import SteamLogin from '../../components/SteamLogin.vue'

const route = useRoute()
const {t} = useI18n()

const show = ref(true)
const closing = ref(false)

const accountName = computed(() => {
  return typeof route.query.account_name === 'string' ? route.query.account_name : ''
})

const windowKey = computed(() => {
  return typeof route.query.window_key === 'string' ? route.query.window_key : '/steam/login'
})

const closeWindow = async () => {
  if (closing.value) return
  closing.value = true
  await window.ipcRenderer.invoke('close-window', {key: windowKey.value})
}

const handleSuccess = async () => {
  ElMessage.success(t('accountHealth.loginSuccess', {account: accountName.value}))
  await closeWindow()
}

const handleFailed = () => {
  show.value = true
}

watch(show, (value) => {
  if (!value) {
    closeWindow().then()
  }
})
</script>

<template>
  <div class="steam-login-view">
    <SteamLogin
        v-model:show="show"
        :account_name="accountName"
        @success="handleSuccess"
        @failed="handleFailed"
    />
  </div>
</template>

<style scoped>
.steam-login-view {
  min-height: 100vh;
  background: var(--el-bg-color);
}
</style>

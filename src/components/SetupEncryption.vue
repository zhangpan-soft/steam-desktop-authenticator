<script setup lang="ts">

import {reactive} from "vue";
import Passkey from "./Passkey.vue";
import { useI18n } from 'vue-i18n'

const currentData = reactive<{
  passkeyModel: boolean
}>({
  passkeyModel: false
})

const { t } = useI18n()

const handleSetupEncryption = () => {
  currentData.passkeyModel = true
}
</script>

<template>
  <el-button size="small" @click="handleSetupEncryption">{{ t('home.setupEncryption') }}</el-button>

  <Passkey v-if="currentData.passkeyModel"
           v-model:show="currentData.passkeyModel"
           :show-cancel-button="true"/>
</template>

<style scoped>

</style>

<script setup lang="ts">

import {reactive} from "vue";
import Passkey from "./Passkey.vue";

const currentData = reactive<{
  passkeyModel: boolean
}>({
  passkeyModel: false
})

const handleSetupEncryption = () => {
  currentData.passkeyModel = true
}
</script>

<template>
  <el-button size="small" @click="handleSetupEncryption">Setup Encryption</el-button>

  <Passkey v-if="currentData.passkeyModel" v-model:show="currentData.passkeyModel"
           :show-cancel-button="true"/>
</template>

<style scoped>

</style>

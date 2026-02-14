<script setup lang="ts">
import {reactive} from "vue";

const currentData = reactive<{
  passkey: string
}>({
  passkey: ''
})

function handleCancel(){

}

function handleConfirm(){

}
</script>

<template>
  <div class="container">
    <div class="login-form">
      <div class="form-row">
        <p class="login-desc">
          Enter your encryption passkey if your .maFile is encrypted:
        </p>
        <el-input v-model="currentData.passkey" placeholder=""/>
      </div>
      <p class="login-desc">
        If you import an encrypted .maFile, the manifest file must be next to it.
      </p>
      <div class="dialog-footer">
        <el-button type="default" @click="handleCancel">Cancel</el-button>
        <el-button type="default" @click="handleConfirm">Select .maFile file to Import</el-button>
      </div>
    </div>
  </div>

</template>

<style scoped>

</style>

<script setup lang="ts">
import {reactive} from "vue";

const currentData = reactive<{
  passkey: string
}>({
  passkey: ''
})

function handleConfirm(){

}
</script>

<template>
<div class="container">
  <el-input v-model="currentData.passkey" placeholder="Please Input SDA Passkey">
    <template #append @click="handleConfirm">确定</template>
  </el-input>
</div>
</template>

<style scoped>

</style>

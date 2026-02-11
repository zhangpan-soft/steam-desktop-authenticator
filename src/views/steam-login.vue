<script setup lang="ts">

import {ref} from "vue";
import {FormInstance} from "element-plus";

const formRef = ref<FormInstance>()

</script>

<template>
  <el-card>
    <template #header>
      <el-row justify="center">
        <el-text size="large">Steam Login</el-text>
      </el-row>
    </template>
    <el-form ref="formRef" label-position="top" label-width="auto">

    </el-form>
  </el-card>
</template>

<style scoped>

</style>

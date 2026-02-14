<script setup lang="ts">
function initialSelect(type: number){

}
</script>

<template>
  <el-row>
    <el-text type="info" size="small">
      Please Select the MaFiles Folder
    </el-text>
  </el-row>
  <el-row>
    <el-button type="default" style="width: 100%" @click="initialSelect(1)">Default</el-button>
  </el-row>
  <el-row>
    <el-button type="default" style="width: 100%" @click="initialSelect(2)">Custom</el-button>
  </el-row>
</template>

<style scoped>

</style>

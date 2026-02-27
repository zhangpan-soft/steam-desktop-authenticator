<script setup lang="ts">

import {computed, onMounted, onUnmounted, reactive} from "vue";

const currentData = reactive<{
  entries: EntryType[]
  account_name: string
  filterText: string
}>({
  entries: [],
  account_name: '',
  filterText: '',
})

const emit = defineEmits<{
  selected: [acc: EntryType]
}>()

const selectAccount = async (acc: EntryType) => {
  console.log('=============', acc);
  currentData.account_name = acc.account_name
  emit('selected', acc)
}
const onSettingsUpdate = (event:any,args:Settings)=>{
  console.log(event,args)
  currentData.entries = [...args.entries]
}
const filterList = computed(()=>{
  if (!currentData.filterText){
    return currentData.entries
  }
  console.log(currentData.entries)
  return currentData.entries.filter(item=>item.account_name.includes(currentData.filterText) || String(item.steamid).includes(currentData.filterText))
})
onMounted(async () => {
  const settings: Settings = await window.ipcRenderer.invoke('settings:get',)
  currentData.entries = [...settings.entries]
  window.ipcRenderer.on('settings:message:change', onSettingsUpdate)
})
onUnmounted(()=>{
  window.ipcRenderer.off('settings:message:change', onSettingsUpdate)
})
</script>

<template>
  <!-- 区域 4: 账号列表 (自适应高度) -->
  <div class="list-section">
    <el-empty class="el-empty" v-if="filterList.length===0" description="No accounts loaded"/>
    <div v-else class="list-container">
      <el-card
          v-for="acc in filterList"
          :key="acc.steamid"
          @click="selectAccount(acc)"
          class="list-item-card"
      >
        <el-row>
          <el-text size="small"
                   :type="currentData.account_name == acc.account_name?'primary':'default'">
            {{ acc.account_name + '\t\t' + acc.steamid }}
          </el-text>
        </el-row>
      </el-card>
    </div>
  </div>
  <el-divider class="custom-divider"/>

  <!-- 区域 5: 底部过滤器 -->
  <div class="section">
    <el-input v-model="currentData.filterText" size="small">
      <template #prefix>Filter:</template>
    </el-input>
  </div>
</template>

<style scoped>

</style>

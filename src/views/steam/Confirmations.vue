<script setup lang="ts">
import {onMounted, reactive} from "vue";
import EResult from "../../utils/EResult.ts";
import {ElMessage} from "element-plus";

const data = reactive<{
  list: Confirmation[]
}>({
  list: []
})

onMounted(() => {
  window.ipcRenderer.invoke('steam:getConfirmations',)
      .then((res: SteamResponse<ConfirmationsResponse>) => {
        if (res.eresult === EResult.OK) {
          data.list = res.response?.conf || []
        } else {
          ElMessage.error(`Failed to get confirmations.${res.message || ''}`)
        }
      })
      .catch(err=>{
        ElMessage.error(`Failed to get confirmations.${err.message || err || ''}`)
      })
})
</script>

<template>
  <div class="container">
    <el-header class="header-center">
        <el-text size="large" style="font-weight: bold">Confirmations</el-text>
    </el-header>
    <el-main>
      <div class="list-section">
        <el-card v-if="data.list.length===0" class="empty-card">
          <el-empty description="No Confirmations"/>
        </el-card>
        <div v-else class="list-container">
          <el-card
              v-for="item in data.list"
              :key="item.id"
              class="list-item-card"
          >
            <el-row>
              <el-col :span="4">
                <el-image :src="item.icon" style="width: 40px; height: 40px" fit="cover"/>
              </el-col>
              <el-col :span="20">
                <el-row>
                  <el-text truncated>{{ item.headline }}</el-text>
                </el-row>
                <el-row>
                  <el-text size="small" type="info" truncated>{{ item.summary.join(', ') }}</el-text>
                </el-row>
                <el-row>
                  <el-text size="small" type="info">{{ item.creation_time }}</el-text>
                </el-row>
              </el-col>
            </el-row>
          </el-card>
        </div>
      </div>
    </el-main>
  </div>
</template>

<style scoped>
.el-header {
  --el-header-padding: 0px;
  --el-header-height: 40px;
  flex-shrink: 0;
  border-bottom: 1px solid #dcdfe6;
}

/* 强制居中样式 */
.header-center {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.el-main {
  --el-main-padding: 0px;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.list-item-card {
  padding: 10px;
}
</style>

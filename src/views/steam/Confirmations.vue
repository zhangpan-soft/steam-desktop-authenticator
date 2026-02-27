<script setup lang="ts">
import {onMounted, reactive, watch} from "vue";
import EResult from "../../utils/EResult.ts";
import {ElMessage} from "element-plus";
import {useRoute} from "vue-router";
import CustomContainer from "../../components/CustomContainer.vue";
import {Check, Close, Picture, View} from "@element-plus/icons-vue";
import CustomDialog from "../../components/CustomDialog.vue";

interface ConfirmationItem extends Confirmation {
  selected: boolean
}

const data = reactive<{
  loading: boolean
  list: ConfirmationItem[]
  viewItem: ConfirmationItem | null
  viewModel: boolean
}>({
  loading: false,
  list: [],
  viewItem: null,
  viewModel: false
})

const route = useRoute()

const fetchConfirmations = async () => {
  data.loading = true
  const account_name = route.query.account_name
  try {
    const res: SteamResponse<ConfirmationsResponse> = await window.ipcRenderer.invoke('steam:getConfirmations',{account_name})
    if (res.eresult === EResult.OK) {
      data.list = (res.response?.conf || []).map((item: any) => ({
        ...item,
        selected: false
      }))
    } else {
      ElMessage.error(`Failed to get confirmations.${res.message || ''}`)
    }
  }catch (err: any) {
    ElMessage.error(`Failed to get confirmations.${err.message || err || ''}`)
  } finally {
    data.loading = false
  }
}

onMounted(fetchConfirmations)

watch(() => route.query.account_name, (newVal) => {
  if (newVal) {
    fetchConfirmations()
  }
})

const getTypeLabel = (type: number) => {
  switch (type) {
    case 1: return 'Generic'
    case 2: return 'Trade'
    case 3: return 'Market'
    case 4: return 'Account'
    case 5: return 'Phone'
    case 6: return 'Recovery'
    default: return 'Unknown'
  }
}

const getTypeTagType = (type: number) => {
  switch (type) {
    case 2: return 'success'
    case 3: return 'warning'
    case 4:
    case 5:
    case 6: return 'danger'
    default: return 'info'
  }
}

const handleView = (item: ConfirmationItem) => {
  data.viewItem = item
  data.viewModel = true
}

const handleRespond = async (item: ConfirmationItem, action: 'accept' | 'cancel') => {
  data.loading = true
  try {
    const res: SteamResponse<any> = await window.ipcRenderer.invoke('steam:confirmations:respond', {
      account_name: route.query.account_name,
      confId: item.id,
      confKey: item.nonce,
      action: action
    })

    if (res.eresult === EResult.OK) {
      ElMessage.success(`${action === 'accept' ? 'Confirmed' : 'Canceled'} successfully`)
      // 移除已处理的项
      data.list = data.list.filter(i => i.id !== item.id)
    } else {
      ElMessage.error(`Failed to ${action}. ${res.message || ''}`)
    }
  } catch (e: any) {
    ElMessage.error(e.message || 'Unknown error')
  } finally {
    data.loading = false
  }
}

</script>

<template>
  <CustomContainer :title="'Confirmations'" :loading="data.loading" :show-cancel-button="false" :show-confirm-button="false">
    <div class="list-section">
      <el-card v-if="data.list.length===0" class="empty-card">
        <el-empty description="No Confirmations"/>
      </el-card>
      <div v-else class="list-container">
        <div
            v-for="item in data.list"
            :key="item.id"
            class="confirmation-item"
            @click="item.selected = !item.selected"
        >
          <div class="item-checkbox">
            <el-checkbox v-model="item.selected" @click.stop size="large"/>
          </div>
          <div class="item-icon" :class="{ 'is-avatar': item.type === 2 }">
            <el-image :src="item.icon" loading="lazy" fit="cover">
              <template #error>
                <el-icon><Picture /></el-icon>
              </template>
            </el-image>
          </div>
          <div class="item-info">
            <div class="item-header-row">
              <el-tag size="small" :type="getTypeTagType(item.type)" effect="light" class="type-tag">
                {{ getTypeLabel(item.type) }}
              </el-tag>
              <div class="item-headline">{{ item.headline }}</div>
            </div>
            <div class="item-summary" v-for="(line, idx) in item.summary" :key="idx">{{ line }}</div>
            <div class="item-time">{{ item.creation_time }}</div>
          </div>
          <div class="item-actions">
            <el-button-group>
              <el-button :icon="View" size="small" circle @click.stop="handleView(item)" />
              <el-button :icon="Check" type="success" size="small" circle @click.stop="handleRespond(item, 'accept')" />
              <el-button :icon="Close" type="danger" size="small" circle @click.stop="handleRespond(item, 'cancel')" />
            </el-button-group>
          </div>
        </div>
      </div>
    </div>
  </CustomContainer>

  <!-- 详情弹窗 -->
  <CustomDialog
      v-model:show="data.viewModel"
      :title="'Confirmation Details'"
      :show-cancel-button="false"
      confirm-button-text="Close"
      @confirm="data.viewModel = false"
  >
    <div v-if="data.viewItem" class="detail-content">
      <div class="detail-icon">
        <el-image :src="data.viewItem.icon" fit="contain" style="width: 100px; height: 100px">
          <template #error><el-icon size="50"><Picture /></el-icon></template>
        </el-image>
      </div>
      <h3 class="detail-headline">{{ data.viewItem.headline }}</h3>
      <el-divider style="margin: 12px 0" />
      <div class="detail-summary">
        <p v-for="(line, idx) in data.viewItem.summary" :key="idx">{{ line }}</p>
      </div>
      <el-divider style="margin: 12px 0" />
      <div class="detail-meta">
        <p><strong>Type:</strong> {{ getTypeLabel(data.viewItem.type) }}</p>
        <p><strong>Time:</strong> {{ data.viewItem.creation_time }}</p>
        <p><strong>ID:</strong> {{ data.viewItem.id }}</p>
      </div>
    </div>
  </CustomDialog>
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

.list-container {
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 12px;
}

.confirmation-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.confirmation-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.item-checkbox {
  margin-right: 12px;
  display: flex;
  align-items: center;
}

.item-icon {
  width: 50px;
  height: 50px;
  margin-right: 16px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background-color: #f5f7fa;
  display: flex;
  justify-content: center;
  align-items: center;
}

.item-icon.is-avatar {
  border-radius: 50%;
  border: 1px solid var(--el-border-color-lighter);
}

.item-icon .el-image {
  width: 100%;
  height: 100%;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.item-actions {
  margin-left: 12px;
}

.item-header-row {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.type-tag {
  margin-right: 8px;
  flex-shrink: 0;
}

.item-headline {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-summary {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.4;
  word-break: break-word;
}

.item-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

/* 详情弹窗样式 */
.detail-content {
  text-align: center;
  padding: 10px;
}
.detail-headline {
  margin-top: 10px;
  color: var(--el-text-color-primary);
}
.detail-summary p {
  margin: 5px 0;
  color: var(--el-text-color-regular);
}
.detail-meta p {
  margin: 3px 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>

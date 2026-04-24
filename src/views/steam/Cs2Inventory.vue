<script setup lang="ts">
import {computed, onMounted, reactive, watch} from "vue";
import {ElMessage} from "element-plus";
import {useI18n} from "vue-i18n";
import {useRoute} from "vue-router";
import {Picture, RefreshRight} from "@element-plus/icons-vue";
import CustomContainer from "../../components/CustomContainer.vue";
import CustomDialog from "../../components/CustomDialog.vue";

const route = useRoute()
const {t, locale} = useI18n()

const data = reactive<{
  loading: boolean
  search: string
  list: InventoryItem[]
  errorMessage: string
  viewItem: InventoryItem | null
  viewModel: boolean
}>({
  loading: false,
  search: '',
  list: [],
  errorMessage: '',
  viewItem: null,
  viewModel: false
})

const accountName = computed(() => {
  const raw = route.query.account_name
  if (typeof raw === 'string') {
    return raw
  }
  if (Array.isArray(raw)) {
    return raw[0] || ''
  }
  return ''
})

const isMarketable = (item: InventoryItem) => Boolean(item.marketable)
const isTradable = (item: InventoryItem) => Boolean(item.tradable)

const getItemImage = (item: InventoryItem, size = '360fx360f') => {
  const icon = item.icon_url_large || item.icon_url
  if (!icon) {
    return ''
  }
  return `https://steamcommunity.com/economy/image/${icon}/${size}`
}

const getNameStyle = (item: InventoryItem) => {
  if (!item.name_color) {
    return undefined
  }
  return {
    color: `#${item.name_color}`
  }
}

const formatDate = (timestamp?: number) => {
  if (!timestamp) {
    return '-'
  }
  const dateLocale = locale.value === 'zh' ? 'zh-CN' : 'en-US'
  return new Intl.DateTimeFormat(dateLocale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(timestamp)
}

const cleanText = (value?: string) => {
  if (!value) {
    return ''
  }
  return value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .trim()
}

const getDescriptionLines = (values?: InventoryDescriptionDescription[]) => {
  return (values || [])
      .map(value => cleanText(value.value))
      .filter(Boolean)
}

const filteredList = computed(() => {
  const keyword = data.search.trim().toLowerCase()
  if (!keyword) {
    return data.list
  }
  return data.list.filter(item => {
    return [
      item.name,
      item.market_name,
      item.market_hash_name,
      item.type,
      item.paint_index,
      item.paint_seed,
      item.float_value,
      item.templateIndex
    ].some(value => String(value || '').toLowerCase().includes(keyword))
  })
})

const stats = computed(() => {
  return {
    total: data.list.length,
    marketable: data.list.filter(item => isMarketable(item)).length,
    tradable: data.list.filter(item => isTradable(item)).length
  }
})

const emptyDescription = computed(() => {
  if (data.errorMessage) {
    return data.errorMessage
  }
  if (data.list.length === 0) {
    return t('cs2Inventory.noInventory')
  }
  return t('cs2Inventory.noResults')
})

const getInventoryErrorMessage = (error?: string, message?: string) => {
  if (error === 'sessionExpired') {
    return t('cs2Inventory.sessionExpired')
  }
  return message || t('errors.unknown')
}

const getRemoteErrorMessage = (e: any) => {
  const message = e?.message || ''
  if (message.includes('Session expired')) {
    return t('cs2Inventory.sessionExpired')
  }
  return message || t('errors.unknown')
}

const sortInventoryItems = (items: InventoryItem[]) => {
  return items.sort((a, b) => {
    const aName = (a.market_hash_name || a.market_name || a.name || '').toLowerCase()
    const bName = (b.market_hash_name || b.market_name || b.name || '').toLowerCase()
    return aName.localeCompare(bName) || a.assetid.localeCompare(b.assetid)
  })
}

const fetchInventory = async () => {
  if (!accountName.value) {
    data.list = []
    data.errorMessage = ''
    return
  }
  data.loading = true
  try {
    const res = await window.ipcRenderer.invoke('steam:getCs2Inventory', {account_name: accountName.value})
    if (res?.success === false) {
      data.list = []
      data.errorMessage = getInventoryErrorMessage(res.error, res.message)
      ElMessage.error(t('cs2Inventory.failedToGet', {
        message: data.errorMessage
      }))
      return
    }
    data.errorMessage = ''
    data.list = sortInventoryItems(Array.isArray(res) ? res : (res?.items || []))
  } catch (e: any) {
    data.list = []
    data.errorMessage = getRemoteErrorMessage(e)
    ElMessage.error(t('cs2Inventory.failedToGet', {
      message: data.errorMessage
    }))
  } finally {
    data.loading = false
  }
}

const openDetails = (item: InventoryItem) => {
  data.viewItem = item
  data.viewModel = true
}

onMounted(fetchInventory)

watch(accountName, () => {
  data.viewItem = null
  data.viewModel = false
  data.errorMessage = ''
  fetchInventory().then()
})
</script>

<template>
  <CustomContainer
      :title="t('cs2Inventory.title')"
      :loading="data.loading"
      :show-cancel-button="false"
      :show-confirm-button="false"
  >
    <div class="toolbar">
      <el-input
          v-model="data.search"
          clearable
          size="small"
          :placeholder="t('cs2Inventory.searchPlaceholder')"
      />
      <el-button size="small" type="default" :icon="RefreshRight" @click="fetchInventory">
        {{ t('cs2Inventory.refresh') }}
      </el-button>
    </div>

    <div class="stats-row">
      <el-tag effect="light">{{ t('cs2Inventory.totalItems', { count: stats.total }) }}</el-tag>
      <el-tag effect="light" type="success">{{ t('cs2Inventory.marketableItems', { count: stats.marketable }) }}</el-tag>
      <el-tag effect="light" type="warning">{{ t('cs2Inventory.tradableItems', { count: stats.tradable }) }}</el-tag>
    </div>

    <el-card v-if="filteredList.length === 0" class="empty-card">
      <el-empty :description="emptyDescription"/>
    </el-card>

    <div v-else class="inventory-grid">
      <el-card
          v-for="item in filteredList"
          :key="`${item.contextid}-${item.assetid}`"
          class="inventory-card"
          shadow="hover"
          @click="openDetails(item)"
      >
        <div class="card-layout">
          <div class="item-image">
            <el-image :src="getItemImage(item)" fit="contain">
              <template #error>
                <div class="item-image-fallback">
                  <el-icon><Picture/></el-icon>
                </div>
              </template>
            </el-image>
          </div>

          <div class="item-body">
            <div class="item-header">
              <div class="item-name" :style="getNameStyle(item)">
                {{ item.name || item.market_name || item.market_hash_name }}
              </div>
              <el-tag v-if="Number(item.amount || 1) > 1" size="small">
                x{{ item.amount }}
              </el-tag>
            </div>

            <div class="item-type">{{ item.type || item.market_name || '-' }}</div>

            <div class="tag-row">
              <el-tag size="small" :type="isMarketable(item) ? 'success' : 'info'" effect="light">
                {{ isMarketable(item) ? t('cs2Inventory.marketable') : t('cs2Inventory.notMarketable') }}
              </el-tag>
              <el-tag size="small" :type="isTradable(item) ? 'success' : 'warning'" effect="light">
                {{ isTradable(item) ? t('cs2Inventory.tradable') : t('cs2Inventory.notTradable') }}
              </el-tag>
            </div>

            <div v-if="isMarketable(item) && !isTradable(item) && item.cd_date" class="cooldown-text">
              {{ t('cs2Inventory.cooldownUntil') }}: {{ formatDate(item.cd_date) }}
            </div>

            <div class="meta-row">
              <span v-if="item.float_value">{{ t('cs2Inventory.float') }}: {{ item.float_value }}</span>
              <span v-if="item.paint_index">{{ t('cs2Inventory.paintIndex') }}: {{ item.paint_index }}</span>
              <span v-if="item.paint_seed">{{ t('cs2Inventory.paintSeed') }}: {{ item.paint_seed }}</span>
            </div>

            <div class="market-name">{{ item.market_hash_name || item.market_name || item.name }}</div>
          </div>
        </div>
      </el-card>
    </div>
  </CustomContainer>

  <CustomDialog
      v-model:show="data.viewModel"
      :title="t('cs2Inventory.detailsTitle')"
      :show-cancel-button="false"
      :confirm-button-text="t('dialog.close')"
      @confirm="data.viewModel = false"
  >
    <div v-if="data.viewItem" class="detail-content">
      <div class="detail-hero">
        <div class="detail-image">
          <el-image :src="getItemImage(data.viewItem, '600fx600f')" fit="contain">
            <template #error>
              <div class="item-image-fallback detail-fallback">
                <el-icon><Picture/></el-icon>
              </div>
            </template>
          </el-image>
        </div>

        <div class="detail-main">
          <div class="detail-name" :style="getNameStyle(data.viewItem)">
            {{ data.viewItem.name || data.viewItem.market_name || data.viewItem.market_hash_name }}
          </div>
          <div class="detail-type">{{ data.viewItem.type || '-' }}</div>
          <div class="tag-row">
            <el-tag size="small" :type="isMarketable(data.viewItem) ? 'success' : 'info'" effect="light">
              {{ isMarketable(data.viewItem) ? t('cs2Inventory.marketable') : t('cs2Inventory.notMarketable') }}
            </el-tag>
            <el-tag size="small" :type="isTradable(data.viewItem) ? 'success' : 'warning'" effect="light">
              {{ isTradable(data.viewItem) ? t('cs2Inventory.tradable') : t('cs2Inventory.notTradable') }}
            </el-tag>
          </div>
          <div v-if="isMarketable(data.viewItem) && !isTradable(data.viewItem) && data.viewItem.cd_date" class="cooldown-text">
            {{ t('cs2Inventory.cooldownUntil') }}: {{ formatDate(data.viewItem.cd_date) }}
          </div>
        </div>
      </div>

      <el-divider/>

      <div class="detail-grid">
        <div class="detail-field">
          <span class="detail-label">{{ t('cs2Inventory.amount') }}</span>
          <span>{{ data.viewItem.amount || '1' }}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">{{ t('cs2Inventory.assetId') }}</span>
          <span>{{ data.viewItem.assetid }}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">{{ t('cs2Inventory.marketName') }}</span>
          <span>{{ data.viewItem.market_name || '-' }}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">{{ t('cs2Inventory.marketHashName') }}</span>
          <span>{{ data.viewItem.market_hash_name || '-' }}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">{{ t('cs2Inventory.float') }}</span>
          <span>{{ data.viewItem.float_value || '-' }}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">{{ t('cs2Inventory.paintIndex') }}</span>
          <span>{{ data.viewItem.paint_index || '-' }}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">{{ t('cs2Inventory.paintSeed') }}</span>
          <span>{{ data.viewItem.paint_seed || '-' }}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">{{ t('cs2Inventory.templateIndex') }}</span>
          <span>{{ data.viewItem.templateIndex || '-' }}</span>
        </div>
      </div>

      <div v-if="(data.viewItem.stickerFloatValues || []).length" class="detail-section">
        <div class="detail-section-title">{{ t('cs2Inventory.stickerWear') }}</div>
        <div class="value-list">
          <el-tag
              v-for="(value, index) in data.viewItem.stickerFloatValues || []"
              :key="`${data.viewItem.assetid}-sticker-${index}`"
              effect="light"
              size="small"
          >
            {{ value }}
          </el-tag>
        </div>
      </div>

      <div v-if="getDescriptionLines(data.viewItem.owner_descriptions).length" class="detail-section">
        <div class="detail-section-title">{{ t('cs2Inventory.ownerDescriptions') }}</div>
        <div class="text-list">
          <p v-for="(line, index) in getDescriptionLines(data.viewItem.owner_descriptions)" :key="`${data.viewItem.assetid}-owner-${index}`">
            {{ line }}
          </p>
        </div>
      </div>

      <div v-if="getDescriptionLines(data.viewItem.descriptions).length" class="detail-section">
        <div class="detail-section-title">{{ t('cs2Inventory.descriptions') }}</div>
        <div class="text-list">
          <p v-for="(line, index) in getDescriptionLines(data.viewItem.descriptions)" :key="`${data.viewItem.assetid}-desc-${index}`">
            {{ line }}
          </p>
        </div>
      </div>
    </div>
  </CustomDialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  padding: 8px;
}

.toolbar .el-input {
  flex: 1;
}

.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 8px 8px;
}

.empty-card {
  margin: 8px;
}

.inventory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  padding: 8px;
}

.inventory-card {
  cursor: pointer;
  border-radius: 12px;
}

.card-layout {
  display: flex;
  gap: 14px;
}

.item-image,
.detail-image {
  width: 110px;
  height: 110px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, #f7f8fa 0%, #eef1f6 100%);
}

.detail-image {
  width: 180px;
  height: 180px;
}

.item-image :deep(.el-image),
.detail-image :deep(.el-image) {
  width: 100%;
  height: 100%;
}

.item-image-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 28px;
}

.detail-fallback {
  font-size: 40px;
}

.item-body,
.detail-main {
  flex: 1;
  min-width: 0;
}

.item-header,
.detail-hero {
  display: flex;
  gap: 16px;
}

.item-header {
  align-items: flex-start;
  justify-content: space-between;
}

.item-name,
.detail-name {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
}

.detail-name {
  font-size: 20px;
}

.item-type,
.detail-type,
.market-name,
.cooldown-text {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-hero {
  align-items: flex-start;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f7f8fa;
}

.detail-label,
.detail-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.value-list,
.text-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.text-list {
  flex-direction: column;
  gap: 6px;
}

.text-list p {
  margin: 0;
  line-height: 1.55;
  color: var(--el-text-color-regular);
}

@media (max-width: 900px) {
  .inventory-grid {
    grid-template-columns: 1fr;
  }

  .detail-hero {
    flex-direction: column;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>

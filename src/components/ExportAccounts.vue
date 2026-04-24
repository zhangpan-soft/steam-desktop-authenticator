<script setup lang="ts">
import {reactive} from "vue";
import CustomDialog from "./CustomDialog.vue";
import {Hide, Lock, Unlock, View} from "@element-plus/icons-vue";
import {useI18n} from "vue-i18n";
import {ElMessage} from "element-plus";

const props = withDefaults(defineProps<{
  account_name?: string
}>(), {})

const show = defineModel<boolean>('show', {default: false})
const {t} = useI18n()

const currentData = reactive<{
  loading: boolean
  scope: 'current' | 'all'
  mode: 'plain' | 'encrypted'
  passkey: string
  locked: boolean
  targetDir: string
}>({
  loading: false,
  scope: 'current',
  mode: 'plain',
  passkey: '',
  locked: true,
  targetDir: '',
})

const getExportErrorMessage = (message: string) => {
  switch (message) {
    case 'exportTargetRequired':
      return t('export.targetRequired')
    case 'exportTargetIsSource':
      return t('export.targetIsSource')
    case 'sdaPasskeyRequired':
      return t('export.sdaPasskeyRequired')
    case 'exportPasskeyRequired':
      return t('export.passkeyRequired')
    case 'exportNoAccounts':
      return t('export.noAccounts')
    default:
      return message || t('errors.unknown')
  }
}

const events = {
  async handleSelectFolder() {
    const res = await window.ipcRenderer.invoke('showOpenDialog', {
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled) {
      return
    }
    currentData.targetDir = res.filePaths?.[0] || ''
  },
  handleCancel() {
    show.value = false
    currentData.loading = false
  },
  async handleConfirm() {
    if (currentData.scope === 'current' && !props.account_name) {
      ElMessage.warning(t('export.currentAccountRequired'))
      return
    }
    if (!currentData.targetDir) {
      ElMessage.warning(t('export.targetRequired'))
      return
    }
    if (currentData.mode === 'encrypted' && !currentData.passkey.trim()) {
      ElMessage.warning(t('export.passkeyRequired'))
      return
    }

    currentData.loading = true
    try {
      const res = await window.ipcRenderer.invoke('exportMaFiles', {
        scope: currentData.scope,
        account_name: props.account_name,
        targetDir: currentData.targetDir,
        encrypted: currentData.mode === 'encrypted',
        passkey: currentData.passkey,
      })

      if (res.failed?.length) {
        ElMessage.warning(t('export.partialSuccess', {
          count: res.count,
          failed: res.failed.length
        }))
      } else {
        ElMessage.success(t('export.success', {count: res.count}))
      }
      if (res.count > 0) {
        show.value = false
      }
    } catch (e: any) {
      ElMessage.error(t('export.failed', {
        message: getExportErrorMessage(e?.message)
      }))
    } finally {
      currentData.loading = false
    }
  }
}
</script>

<template>
  <CustomDialog
      v-model:show="show"
      :title="t('export.title')"
      :loading="currentData.loading"
      @cancel="events.handleCancel"
      @confirm="events.handleConfirm"
  >
    <el-row class="form-row">
      <el-text size="small">{{ t('export.scopeLabel') }}</el-text>
      <el-radio-group v-model="currentData.scope" size="small">
        <el-radio-button label="current">{{ t('export.scopeCurrent') }}</el-radio-button>
        <el-radio-button label="all">{{ t('export.scopeAll') }}</el-radio-button>
      </el-radio-group>
    </el-row>

    <el-row class="form-row">
      <el-text size="small">{{ t('export.modeLabel') }}</el-text>
      <el-radio-group v-model="currentData.mode" size="small">
        <el-radio-button label="plain">{{ t('export.modePlain') }}</el-radio-button>
        <el-radio-button label="encrypted">{{ t('export.modeEncrypted') }}</el-radio-button>
      </el-radio-group>
    </el-row>

    <el-row v-if="currentData.mode === 'encrypted'" class="form-row">
      <el-text size="small">{{ t('export.passkeyLabel') }}</el-text>
      <el-input
          v-model="currentData.passkey"
          size="small"
          :placeholder="t('export.passkeyPlaceholder')"
          :type="currentData.locked ? 'password' : 'text'"
      >
        <template #prefix>
          <el-icon>
            <component :is="currentData.locked ? Lock : Unlock"/>
          </el-icon>
        </template>
        <template #suffix>
          <el-icon
              style="cursor: pointer;"
              @click="currentData.locked = !currentData.locked"
          >
            <component :is="currentData.locked ? Hide : View"/>
          </el-icon>
        </template>
      </el-input>
    </el-row>

    <el-row class="form-row">
      <el-text size="small">{{ t('export.targetLabel') }}</el-text>
      <div class="target-row">
        <el-input
            v-model="currentData.targetDir"
            readonly
            size="small"
            :placeholder="t('export.targetPlaceholder')"
        />
        <el-button size="small" @click="events.handleSelectFolder">
          {{ t('export.selectFolder') }}
        </el-button>
      </div>
    </el-row>
  </CustomDialog>
</template>

<style scoped>
.form-row {
  width: 100%;
  margin-bottom: 10px;
  gap: 6px;
}

.form-row :deep(.el-text) {
  width: 100%;
}

.target-row {
  display: flex;
  width: 100%;
  gap: 6px;
}

.target-row .el-input {
  flex: 1;
}
</style>

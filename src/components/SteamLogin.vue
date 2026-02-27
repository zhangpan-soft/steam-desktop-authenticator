<script setup lang="ts">
import {onMounted, onUnmounted, reactive, ref} from "vue";
import {ElMessage, ElMessageBox} from "element-plus";
import type {FormInstance} from "element-plus";
import {Hide, Lock, UserFilled, View, Unlock} from "@element-plus/icons-vue";
import CustomDialog from "./CustomDialog.vue";

const show = defineModel<boolean>('show', { default: false })
const props = withDefaults(defineProps<{
  account_name?: string;
  shared_secret?: string
}>(), {})

// 这种写法对 IDE 自动补全最友好
const emit = defineEmits<{
  success: [sesssion: SteamSession]
  failed: [err: Error]
}>()

const currentData = reactive({
  loading: false,
  loginForm: {
    account_name: '',
    password: '',
    passwordLocked: true,
    rules: {
      account_name: [{required: true, message: 'Please input your account name', trigger: 'blur'}],
      password: [{required: true, message: 'Please input your password', trigger: 'blur'}]
    }
  }
})

const loginFormRef = ref<FormInstance>()

const events = {
  async handleCancel(){
    show.value = false
    currentData.loading = false
    if (currentData.loginForm.account_name) {
      // 调用 preload 中暴露的 invoke
      await window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name})
    }
  },
  async handleConfirm(){
    if (!loginFormRef.value) return
    currentData.loading = true
    try {
      await loginFormRef.value.validate()
      await window.ipcRenderer.invoke('steam:login', {
        account_name: currentData.loginForm.account_name,
        password: currentData.loginForm.password,
        shared_secret: props.shared_secret
      })
    } catch (e: any) {
      if (e?.message) ElMessage.error(e.message)
      currentData.loading = false
    }
  },
  async handle2FAPrompt(){
    try {
      const res: any = await ElMessageBox.prompt('Please Input SteamGuard Code Or Confirm In Your SteamGuard App', '2FA', {
        confirmButtonText: 'Confirm',
        cancelButtonText: 'Cancel',
        showClose: false,
        showCancelButton: true,
        buttonSize: 'small',
        closeOnClickModal: false,
        closeOnPressEscape: false,
        center: true,
        inputPattern: /^[a-zA-Z0-9]{5}$/,
        inputErrorMessage: 'Please input a 5-digit code'
      })

      await window.ipcRenderer.invoke('steam:submitSteamGuard', {
        account_name: currentData.loginForm.account_name,
        steamGuardCode: res.value
      })
    } catch (e) {
      show.value = false
      currentData.loading = false
      await window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name})
      emit('failed', new Error('Login Failed'))
    }
  },
  async onLoginStatusChanged(_event: any, args: SteamLoginEvent){
    if (currentData.loginForm.account_name !== args.account_name) return

    switch (args.status) {
      case 'LoginSuccess':
        show.value = false
        currentData.loading = false
        emit('success', {...args.data} as SteamSession)
        break

      case 'Need2FA':
        const steamAccount:SteamAccount = await window.ipcRenderer.invoke('steam:account:get')
          if (!steamAccount.shared_secret){
            if (props.shared_secret) {
              ElMessage.error(`Login Failed`)
              currentData.loading = false
              return
            }
            await this.handle2FAPrompt()
          } else {
            await window.ipcRenderer.invoke('steam:token', {account_name: steamAccount.account_name})
                .then((res)=>{
                  return window.ipcRenderer.invoke('steam:submitSteamGuard',{account_name: steamAccount.account_name, steamGuardCode: res.token})
                })
          }
        break

      default:
        if (args.result) {
          ElMessage.error(`Login Failed, Please Re-Try Later.{${args.result}}`)
        } else if (args.error_message) {
          ElMessage.error(`Login Failed, {${args.result}}, {${args.error_message}}.`)
        } else {
          ElMessage.error(`Login Failed, Please Re-Try Later.`)
        }
        await window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name}).then(() => {
          currentData.loading = false
        })
    }
  }
}

// --- 生命周期 ---

onMounted(() => {
  if (props.account_name) {
    currentData.loginForm.account_name = props.account_name
  }
  window.ipcRenderer.on('steam:message:login-status-changed', events.onLoginStatusChanged)
})

onUnmounted(() => {
  window.ipcRenderer.off('steam:message:login-status-changed', events.onLoginStatusChanged)
})
</script>

<template>
  <CustomDialog :title="'Steam Login'"
                :loading="currentData.loading"
                v-model:show="show"
                @cancel="events.handleCancel"
                @confirm="events.handleConfirm">

    <el-form
        ref="loginFormRef"
        :model="currentData.loginForm"
        label-width="auto"
        label-position="top"
        :rules="currentData.loginForm.rules"
        size="small"
    >
      <el-form-item prop="account_name" label="Account">
        <el-input v-model="currentData.loginForm.account_name" :readonly="!!props.account_name">
          <template #prefix>
            <el-icon>
              <UserFilled/>
            </el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item prop="password" label="Password">
        <el-input
            v-model="currentData.loginForm.password"
            :type="currentData.loginForm.passwordLocked ? 'password' : 'text'"
        >
          <template #prefix>
            <el-icon>
              <component :is="currentData.loginForm.passwordLocked ? Lock : Unlock"/>
            </el-icon>
          </template>
          <template #suffix>
            <el-icon
                style="cursor: pointer;"
                @click="currentData.loginForm.passwordLocked = !currentData.loginForm.passwordLocked"
            >
              <component :is="currentData.loginForm.passwordLocked ? Hide : View"/>
            </el-icon>
          </template>
        </el-input>
      </el-form-item>
    </el-form>
  </CustomDialog>
</template>

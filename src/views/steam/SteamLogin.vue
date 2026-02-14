<script setup lang="ts">
import {onMounted, reactive, ref} from 'vue'
import {Hide, Lock, Unlock, UserFilled, View} from "@element-plus/icons-vue";
import {ElMessage, FormInstance, FormItemRule, FormRules} from "element-plus";
import {useRoute} from "vue-router";

const route = useRoute()

const loginFormRef = ref<FormInstance>()

type LoginFormType = {
  account_name: string,
  password: string
  steamGuardCode: string
  showSteamGuardCode: boolean
  showAccountName: boolean,
  showPassword: boolean,
  accountPasswordLoginCancelLoading: boolean
  accountPasswordLoginConfirmLoading: boolean
  steamGuardCodeCancelLoading: boolean
  steamGuardCodeConfirmLoading: boolean
  loginType: SteamLoginType,
  passwordLocked: boolean,
  passwordInputType: 'password' | 'text',
  rules: FormRules,
  steamGuardCodeText: string,
}

const defaultAccountNameRules: FormItemRule[] = [
  {
    required: true,
    message: 'Please input your account name',
    trigger: 'blur'
  }
]

const defaultPasswordRules: FormItemRule[] = [
  {
    required: true,
    message: 'Please input your password',
    trigger: 'blur'
  }
]

const defaultSteamGuardCodeRules: FormItemRule[] = [
  {
    required: true,
    message: 'Please input your Steam Guard Code',
    trigger: 'blur'
  },
  {
    validator: (rule, value, callback) => {
      console.log(rule)
      if (value.length !== 5) {
        callback(new Error('Steam Guard Code must be 5 digits'))
      } else {
        callback()
      }
    }
  }
]

const defaultLoginForm: LoginFormType = {
  account_name: '',
  password: '',
  steamGuardCode: '',
  showSteamGuardCode: false,
  showAccountName: true,
  showPassword: true,
  accountPasswordLoginCancelLoading: false,
  accountPasswordLoginConfirmLoading: false,
  steamGuardCodeCancelLoading: false,
  steamGuardCodeConfirmLoading: false,
  loginType: 'NewAccount',
  passwordLocked: true,
  passwordInputType: 'password',
  rules: {
    account_name: [...defaultAccountNameRules],
    password: [...defaultPasswordRules],
    steamGuardCode: [...defaultSteamGuardCodeRules]
  },
  steamGuardCodeText: ''
}

const currentData = reactive<{
  loginForm: LoginFormType
  currentSteamGuard: SteamGuard
}>({
  loginForm: {...defaultLoginForm},
  currentSteamGuard: {} as SteamGuard
})

type SteamLoginOptions = {
  account_name: string,
  password?: string,
  steamGuardCode?: string,
  refresh_token?: string,
  shared_secret?: string
}

function steamLogin(options: SteamLoginOptions) {
  return window.ipcRenderer.invoke('steam:login', options)
}

function cancelSteamLogin() {
  currentData.loginForm.accountPasswordLoginConfirmLoading = true
  if (!currentData.loginForm.account_name || currentData.loginForm.account_name.length === 0) {
    closeWindow().finally(() => {
      currentData.loginForm.accountPasswordLoginConfirmLoading = false
    })
  } else {
    window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name})
        .then(() => closeWindow())
        .finally(() => {
          currentData.loginForm.accountPasswordLoginConfirmLoading = false
        })
  }
}

function handleAccountPasswordLoginCancel() {
  cancelSteamLogin()
}

function closeWindow() {
  return window.ipcRenderer.invoke('close-window', {hash: '/steam/steamLogin'})
}

function handleAccountPasswordLoginConfirm(formEl: FormInstance | undefined) {
  if (!formEl) {
    return
  }
  currentData.loginForm.accountPasswordLoginConfirmLoading = true
  currentData.loginForm.rules['steamGuardCode'] = []
  formEl.validate((valid: boolean) => {
    if (!valid) {
      currentData.loginForm.accountPasswordLoginConfirmLoading = false
      return
    }
    steamLogin({
      account_name: currentData.loginForm.account_name,
      password: currentData.loginForm.password,
      shared_secret: currentData.currentSteamGuard.shared_secret
    }).then()
  })
}

function handleSteamGuardCodeCancel() {
  cancelSteamLogin()
}

function handleSteamGuardCodeConfirm() {
  window.ipcRenderer.invoke('steam:submitSteamGuard', {
    account_name: currentData.loginForm.account_name,
    steamGuardCode: currentData.loginForm.steamGuardCode
  }).catch(err => {
    ElMessage.error(err.message)
  })
}

onMounted(() => {
  console.log(route)
  currentData.loginForm.loginType = route.query.loginType as SteamLoginType
  currentData.loginForm.account_name = route.query.account_name as string
  const steamGuard: SteamGuard = {
    shared_secret: route.query.shared_secret as string,
    serial_number: route.query.serial_number as string,
    revocation_code: route.query.revocation as string,
    uri: route.query.uri as string,
    server_time: route.query.server_time as string,
    account_name: route.query.account_name as string,
    token_gid: route.query.token_gid as string,
    identity_secret: route.query.identity_secret as string,
    secret_1: route.query.secret_1 as string,
    status: parseInt(route.query.status as string),
    device_id: route.query.device_id as string,
    fully_enrolled: route.query.full_enrolled as string === 'true',
    steamid: route.query.steamid as string,
  }
  currentData.currentSteamGuard = {...steamGuard}
})

window.ipcRenderer.on('steam:message:login-status-changed', (event, args: SteamLoginEvent) => {
  console.log('----------------------')
  console.log(event, args)
  if (currentData.loginForm.account_name !== args.account_name) {
    window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name}).then()
    return
  }
  if (args.status === 'LoginSuccess') {
    ElMessage.success('Login Success')
    // 登录成功后，通知主窗口并关闭自己
    // 这里可以发送一个 IPC 消息给主窗口，或者主窗口监听这个事件
    // 由于是同一个应用，主窗口也会收到这个事件，所以这里只需要关闭自己
    // todo
    if (currentData.loginForm.loginType === 'ImportSda') {
      const steamAccount: SteamAccount = {...currentData.currentSteamGuard}
      steamAccount.Session = {...args.data} as SteamSession
      window.ipcRenderer.invoke('steam:account:set', steamAccount)
          .then(() => {
            ElMessage.success('Import Success')
          }).finally(() => closeWindow().then())
    } else if (currentData.loginForm.loginType === 'NewAccount') {

    } else if (currentData.loginForm.loginType === 'ReLogin') {

    } else if (currentData.loginForm.loginType === 'RefreshToken') {

    }
  } else if (args.status === 'Timeout') {
    ElMessage.error('Login Timeout, Please Re-Try Later')
    window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name}).finally(() => {
      currentData.loginForm.accountPasswordLoginConfirmLoading = false
    })
  } else if (args.status === 'Need2FA') {
    if (args.valid_actions) {
      if (args.valid_actions.find(value => value.type === 3 || value.type === 4)) {
        if (currentData.loginForm.loginType === 'ImportSda') {
          window.ipcRenderer.invoke('steam:submitSteamGuard', {
            account_name: currentData.loginForm.account_name,
            shared_secret: currentData.currentSteamGuard.shared_secret
          }).then()
          return;
        }
        currentData.loginForm.steamGuardCodeText = 'Please Input SteamGuard Code Or Confirm In Your SteamGuard App'
      } else if (args.valid_actions.find(value => value.type === 2 || value.type === 5)) {
        currentData.loginForm.steamGuardCodeText = 'Please Input SteamGuard Code Or Confirm In Your Email'
      } else {
        currentData.loginForm.steamGuardCodeText = 'Please Input SteamGuard Code Or Confirm In Your Machine'
      }
      currentData.loginForm.showSteamGuardCode = true
      currentData.loginForm.showAccountName = false
      currentData.loginForm.showPassword = false
      currentData.loginForm.rules['steamGuardCode'] = [...defaultSteamGuardCodeRules]
    }
  } else if (args.result) {
    ElMessage.error(`Login Failed, Please Re-Try Later.{${args.result}}`)
    window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name}).then(() => {
      currentData.loginForm.accountPasswordLoginConfirmLoading = false
    })
  } else if (args.error_message) {
    ElMessage.error(`Login Failed, {${args.result}}, {${args.error_message}}.`)
    window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name}).then(() => {
      currentData.loginForm.accountPasswordLoginConfirmLoading = false
    })
  } else {
    ElMessage.error(`Login Failed, Please Re-Try Later.`)
    window.ipcRenderer.invoke('steam:cancelLogin', {account_name: currentData.loginForm.account_name}).then(() => {
      currentData.loginForm.accountPasswordLoginConfirmLoading = false
    })
  }
})
</script>

<template>
  <div class="container">
    <el-header class="header-center">
      <el-text size="large" style="font-weight: bold">Steam Login</el-text>
    </el-header>
    <el-main>
      <el-form size="small" :model="currentData.loginForm" label-width="auto" label-position="top" ref="loginFormRef"
               :rules="currentData.loginForm.rules" class="login-form">
        <el-form-item prop="account_name" label="Account" v-if="currentData.loginForm.showAccountName">
          <el-input v-model="currentData.loginForm.account_name"
                    :readonly="currentData.loginForm.loginType==='ImportSda'">
            <template #prefix>
              <el-icon>
                <UserFilled/>
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item prop="password" label="Password" v-if="currentData.loginForm.showPassword">
          <el-input v-model="currentData.loginForm.password" :type="currentData.loginForm.passwordInputType">
            <template #prefix>
              <el-icon v-if="currentData.loginForm.passwordLocked">
                <Lock/>
              </el-icon>
              <el-icon v-if="!currentData.loginForm.passwordLocked">
                <Unlock/>
              </el-icon>
            </template>
            <template #suffix>
              <el-icon v-if="currentData.loginForm.passwordLocked"
                       @click="currentData.loginForm.passwordInputType='text';currentData.loginForm.passwordLocked=false">
                <Hide/>
              </el-icon>
              <el-icon v-if="!currentData.loginForm.passwordLocked"
                       @click="currentData.loginForm.passwordInputType='password';currentData.loginForm.passwordLocked=true">
                <View/>
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item prop="steamGuardCode" label="Steam Guard" v-if="currentData.loginForm.showSteamGuardCode">
          <el-text size="small">
            {{ currentData.loginForm.steamGuardCodeText }}
          </el-text>
          <el-input v-model="currentData.loginForm.steamGuardCode"/>
        </el-form-item>
        <el-form-item v-if="currentData.loginForm.showPassword && currentData.loginForm.showAccountName">
          <el-button type="default" :loading="currentData.loginForm.accountPasswordLoginCancelLoading"
                     @click="handleAccountPasswordLoginCancel">Cancel
          </el-button>
          <el-button type="default" :loading="currentData.loginForm.accountPasswordLoginConfirmLoading"
                     @click="handleAccountPasswordLoginConfirm(loginFormRef)">Confirm
          </el-button>
        </el-form-item>
        <el-form-item v-if="currentData.loginForm.showSteamGuardCode">
          <el-button type="default" :loading="currentData.loginForm.steamGuardCodeCancelLoading"
                     @click="handleSteamGuardCodeCancel">Cancel
          </el-button>
          <el-button type="default" :loading="currentData.loginForm.steamGuardCodeConfirmLoading"
                     @click="handleSteamGuardCodeConfirm">Confirm
          </el-button>
        </el-form-item>
      </el-form>
    </el-main>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: #fff; /* 确保背景色 */
}

.el-header {
  --el-header-padding: 0px;
  --el-header-height: 40px;
  flex-shrink: 0;
  border-bottom: 1px solid #dcdfe6;
}

.header-center {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.el-main {
  --el-main-padding: 20px; /* 给表单一些内边距 */
  flex: 1;
  overflow-y: auto;
}

.login-form {
  max-width: 100%;
}
</style>

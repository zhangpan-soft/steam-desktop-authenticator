<script setup lang="ts">

import {reactive} from "vue";
import SteamLogin from "./SteamLogin.vue";
import EResult from "../utils/EResult.ts";
import {ElLoading, ElMessage, ElMessageBox} from "element-plus";

const currentData = reactive<{
  steamLoginModel: boolean
}>({
  steamLoginModel: false
})

const handleSetupNewAccount = () => {
  currentData.steamLoginModel = true
}

const handleNewAccountLoginSuccess = async (session: SteamSession) => {
  console.log(session)
  const loadingInstance = ElLoading.service({
    lock: true,
    text: 'Setting up new account...',
    background: 'rgba(0, 0, 0, 0.7)',
  })
  try {
    // 判断是否绑定了手机号
    await hasPhoneAttached(session)
    // 注册设备号到steam
    const deviceId = await registerMobileDevice(session) as string
    // 调用添加令牌
    const res: SteamResponse<SteamGuard> = await window.ipcRenderer.invoke('steam:TwoFactor:AddAuthenticator', {
      ...session,
      deviceId
    })

    let steamAccount: SteamAccount

    if (res.eresult === EResult.DuplicateRequest) { // 已有令牌
      await removeAuthenticatorViaChallengeStart(session)
      const smsCode: string = await showSmsCodeBox()
      const steamGuard = await removeAuthenticatorViaChallengeContinue(session, smsCode)
      steamAccount = {...steamGuard, Session: {...session}}
    } else if (res.eresult === EResult.OK) { // 无令牌
      const smsCode: string = await showSmsCodeBox()
      steamAccount = await finalizeAddAuthenticator({...res.response, Session: {...session}} as SteamAccount, smsCode)
    } else {
      throw new Error(`Failed to add authenticator.${res.eresult}`)
    }

    // 执行公共后续步骤
    await postLoginSetup(steamAccount, session)
    ElMessage.success('Authenticator added successfully')

  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    loadingInstance.close()
  }
}


// --- Steam Business Logic Helpers ---

const hasPhoneAttached = async (session: SteamSession) => {
  const res: SteamResponse<boolean> = await window.ipcRenderer.invoke('steam:TwoFactor:hasPhoneAttached', {...session})
  if (res.eresult !== EResult.OK) {
    throw new Error(`Failed to check phone attached.${res.eresult}`)
  }
  if (!res.response) {
    throw new Error('Phone not attached')
  }
}

const registerMobileDevice = async (session: SteamSession) => {
  const res: SteamResponse<string> = await window.ipcRenderer.invoke('steam:MobileDevice:RegisterMobileDevice', {...session})
  if (res.eresult !== EResult.OK) {
    throw new Error(`Failed to register mobile device to steam.${res.eresult}`)
  }
  return res.response
}

const removeAuthenticatorViaChallengeStart = async (session: SteamSession) => {
  const res: SteamResponse<any> = await window.ipcRenderer.invoke('steam:TwoFactor:RemoveAuthenticatorViaChallengeStart', {...session})
  if (res.eresult !== EResult.OK) {
    throw new Error(`Failed to remove authenticator via challenge start.${res.eresult}`)
  }
}

const showSmsCodeBox = async () => {
  const resSmsCode: any = await ElMessageBox.prompt('Please Input Sms Code', 'Sms Code', {
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
  return resSmsCode.value as string
}

const removeAuthenticatorViaChallengeContinue = async (session: SteamSession, smsCode: string): Promise<SteamGuard> => {
  const res: SteamResponse<RemoveAuthenticatorViaChallengeContinueResponse> = await window.ipcRenderer.invoke('steam:TwoFactor:RemoveAuthenticatorViaChallengeContinue', {
    ...session,
    smsCode
  })
  if (res.eresult !== EResult.OK) {
    ElMessage.error(`Sms code verify.${res.eresult}`)
    smsCode = await showSmsCodeBox()
    return removeAuthenticatorViaChallengeContinue(session, smsCode)
  }
  if (!res.response || !res.response.success || !res.response.replacement_token || !res.response.replacement_token.shared_secret) {
    throw new Error(`Failed to remove authenticator via challenge continue.${res.eresult}`)
  }
  return res.response.replacement_token
}

const queryStatus = async (session: SteamSession) => {
  const res: SteamResponse<QueryStatusResponse> = await window.ipcRenderer.invoke('steam:TwoFactor:QueryStatus', {...session})
  if (res.eresult !== EResult.OK) {
    throw new Error(`Failed to query status.${res.eresult}`)
  }
  return res.response
}

const finalizeAddAuthenticator = async (steamAccount: SteamAccount, smsCode: string): Promise<SteamAccount> => {
  let tries = 0
  while (tries <= 30) {
    const res: SteamResponse<FinalizeAuthenticatorResponse> = await window.ipcRenderer.invoke('steam:TwoFactor:FinalizeAddAuthenticator', {
      ...steamAccount,
      smsCode
    })
    if (!res.response) {
      continue
    }
    if (res.response.status === EResult.TwoFactorActivationCodeMismatch) {
      smsCode = await showSmsCodeBox()
      return finalizeAddAuthenticator(steamAccount, smsCode)
    }
    if (res.response.status === EResult.TwoFactorCodeMismatch && tries >= 30) {
      throw new Error(`Failed to finalize add authenticator.${res.eresult}`)
    }
    if (!res.response.success) {
      throw new Error(`Failed to finalize add authenticator.${res.eresult}`)
    }
    if (res.response.want_more) {
      tries++
      continue
    }
    steamAccount.fully_enrolled = true
    return steamAccount
  }
  throw new Error(`Failed to finalize add authenticator.`)
}

// 提取公共的后续设置逻辑：保存账号 -> 更新设置 -> 获取设备ID -> 激活令牌
const postLoginSetup = async (steamAccount: SteamAccount, session: SteamSession) => {
  // 1. 保存当前账号数据
  await window.ipcRenderer.invoke('steam:account:set', steamAccount)

  // 2. 更新 Settings 中的 entries 列表
  const settings: Settings = await window.ipcRenderer.invoke('settings:get')
  const index = settings.entries.findIndex(item => item.account_name === session.account_name)
  if (index === -1) {
    settings.entries.push({steamid: session.SteamID, account_name: session.account_name})
    await window.ipcRenderer.invoke('settings:set', settings)
  }

  // 3. 查询状态以获取 device_identifier 并更新
  const statusRes = await queryStatus(session)
  if (statusRes?.device_identifier) {
    steamAccount.device_id = statusRes.device_identifier
    await window.ipcRenderer.invoke('steam:account:set', steamAccount)
  }

  // 4. 尝试获取一次确认列表以激活令牌
  try {
    await window.ipcRenderer.invoke('steam:getConfirmations', {account_name: session.account_name})
  } catch {
    // 忽略激活时的错误
  }
}



const handleNewAccountLoginFailed = (err: any) => {
  console.log(err)
}
</script>

<template>
  <el-button @click="handleSetupNewAccount" size="small">Setup New Account</el-button>

  <SteamLogin v-if="currentData.steamLoginModel" v-model:show="currentData.steamLoginModel"
              @success="handleNewAccountLoginSuccess" @failed="handleNewAccountLoginFailed"/>
</template>

<style scoped>

</style>

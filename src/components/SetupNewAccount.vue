<script setup lang="ts">

import {reactive, computed} from "vue";
import SteamLogin from "./SteamLogin.vue";
import {ElLoading, ElMessage, ElMessageBox} from "element-plus";
import CustomDialog from "./CustomDialog.vue";
import {useI18n} from 'vue-i18n'

const currentData = reactive<{
  steamLoginModel: boolean
  phoneDialogShowed: boolean
  phoneCountryId: string
  phoneNumber: string
  session?: SteamSession
}>({
  steamLoginModel: false,
  phoneDialogShowed: false,
  phoneCountryId: 'CN',
  phoneNumber: '',
})
// region
const phoneCountryCodes: {
  id: string
  code: string
  name: string
}[] = [
  {"id": "US", "code": "+1", "name": "美国"},
  {"id": "AC", "code": "+247", "name": "AC"},
  {"id": "BQ", "code": "+599", "name": "BQ"},
  {"id": "CU", "code": "+53", "name": "CU"},
  {"id": "CW", "code": "+599", "name": "CW"},
  {"id": "KP", "code": "+850", "name": "KP"},
  {"id": "SS", "code": "+211", "name": "SS"},
  {"id": "SX", "code": "+1", "name": "SX"},
  {"id": "BT", "code": "+975", "name": "不丹"},
  {"id": "TL", "code": "+670", "name": "东帝汶"},
  {"id": "CN", "code": "+86", "name": "中国（大陆）"},
  {"id": "CF", "code": "+236", "name": "中非共和国"},
  {"id": "DK", "code": "+45", "name": "丹麦"},
  {"id": "UA", "code": "+380", "name": "乌克兰"},
  {"id": "UZ", "code": "+998", "name": "乌兹别克斯坦"},
  {"id": "UG", "code": "+256", "name": "乌干达"},
  {"id": "UY", "code": "+598", "name": "乌拉圭"},
  {"id": "TD", "code": "+235", "name": "乍得"},
  {"id": "YE", "code": "+967", "name": "也门"},
  {"id": "AM", "code": "+374", "name": "亚美尼亚"},
  {"id": "IL", "code": "+972", "name": "以色列"},
  {"id": "IQ", "code": "+964", "name": "伊拉克"},
  {"id": "IR", "code": "+98", "name": "伊朗"},
  {"id": "BZ", "code": "+501", "name": "伯利兹"},
  {"id": "CV", "code": "+238", "name": "佛得角"},
  {"id": "RU", "code": "+7", "name": "俄罗斯联邦"},
  {"id": "BG", "code": "+359", "name": "保加利亚"},
  {"id": "HR", "code": "+385", "name": "克罗地亚"},
  {"id": "GU", "code": "+1", "name": "关岛"},
  {"id": "GM", "code": "+220", "name": "冈比亚"},
  {"id": "IS", "code": "+354", "name": "冰岛"},
  {"id": "GN", "code": "+224", "name": "几内亚"},
  {"id": "GW", "code": "+245", "name": "几内亚比绍"},
  {"id": "LI", "code": "+423", "name": "列支敦士登"},
  {"id": "CG", "code": "+242", "name": "刚果共和国"},
  {"id": "CD", "code": "+243", "name": "刚果民主共和国"},
  {"id": "LY", "code": "+218", "name": "利比亚"},
  {"id": "LR", "code": "+231", "name": "利比里亚"},
  {"id": "CA", "code": "+1", "name": "加拿大"},
  {"id": "GH", "code": "+233", "name": "加纳"},
  {"id": "GA", "code": "+241", "name": "加蓬"},
  {"id": "HU", "code": "+36", "name": "匈牙利"},
  {"id": "MK", "code": "+389", "name": "北马其顿共和国"},
  {"id": "MP", "code": "+1", "name": "北马里亚纳群岛"},
  {"id": "ZA", "code": "+27", "name": "南非"},
  {"id": "BW", "code": "+267", "name": "博茨瓦纳"},
  {"id": "QA", "code": "+974", "name": "卡塔尔"},
  {"id": "RW", "code": "+250", "name": "卢旺达"},
  {"id": "LU", "code": "+352", "name": "卢森堡"},
  {"id": "IN", "code": "+91", "name": "印度"},
  {"id": "ID", "code": "+62", "name": "印度尼西亚"},
  {"id": "GT", "code": "+502", "name": "危地马拉"},
  {"id": "EC", "code": "+593", "name": "厄瓜多尔"},
  {"id": "ER", "code": "+291", "name": "厄立特里亚"},
  {"id": "SY", "code": "+963", "name": "叙利亚"},
  {"id": "TW", "code": "+886", "name": "台湾"},
  {"id": "KG", "code": "+996", "name": "吉尔吉斯斯坦"},
  {"id": "DJ", "code": "+253", "name": "吉布提"},
  {"id": "KZ", "code": "+7", "name": "哈萨克斯坦"},
  {"id": "CO", "code": "+57", "name": "哥伦比亚"},
  {"id": "CR", "code": "+506", "name": "哥斯达黎加"},
  {"id": "CM", "code": "+237", "name": "喀麦隆"},
  {"id": "TV", "code": "+688", "name": "图瓦卢"},
  {"id": "TM", "code": "+993", "name": "土库曼斯坦"},
  {"id": "TR", "code": "+90", "name": "土耳其"},
  {"id": "LC", "code": "+1", "name": "圣卢西亚"},
  {"id": "KN", "code": "+1", "name": "圣基茨和尼维斯"},
  {"id": "ST", "code": "+239", "name": "圣多美和普林西比"},
  {"id": "VC", "code": "+1", "name": "圣文森特和格林纳丁斯"},
  {"id": "PM", "code": "+508", "name": "圣皮埃尔和密克隆"},
  {"id": "SH", "code": "+290", "name": "圣赫勒拿"},
  {"id": "SM", "code": "+378", "name": "圣马力诺"},
  {"id": "GY", "code": "+592", "name": "圭亚那"},
  {"id": "TZ", "code": "+255", "name": "坦桑尼亚联合共和国"},
  {"id": "EG", "code": "+20", "name": "埃及"},
  {"id": "ET", "code": "+251", "name": "埃塞俄比亚"},
  {"id": "KI", "code": "+686", "name": "基里巴斯"},
  {"id": "TJ", "code": "+992", "name": "塔吉克斯坦"},
  {"id": "SN", "code": "+221", "name": "塞内加尔"},
  {"id": "RS", "code": "+381", "name": "塞尔维亚"},
  {"id": "SL", "code": "+232", "name": "塞拉利昂"},
  {"id": "CY", "code": "+357", "name": "塞浦路斯"},
  {"id": "SC", "code": "+248", "name": "塞舌尔"},
  {"id": "MX", "code": "+52", "name": "墨西哥"},
  {"id": "TG", "code": "+228", "name": "多哥"},
  {"id": "DM", "code": "+1", "name": "多米尼克"},
  {"id": "DO", "code": "+1", "name": "多米尼加共和国"},
  {"id": "AT", "code": "+43", "name": "奥地利"},
  {"id": "VE", "code": "+58", "name": "委内瑞拉"},
  {"id": "BD", "code": "+880", "name": "孟加拉国"},
  {"id": "AO", "code": "+244", "name": "安哥拉"},
  {"id": "AI", "code": "+1", "name": "安圭拉"},
  {"id": "AG", "code": "+1", "name": "安提瓜和巴布达"},
  {"id": "AD", "code": "+376", "name": "安道尔"},
  {"id": "FM", "code": "+691", "name": "密克罗尼西亚联邦"},
  {"id": "NI", "code": "+505", "name": "尼加拉瓜"},
  {"id": "NG", "code": "+234", "name": "尼日利亚"},
  {"id": "NE", "code": "+227", "name": "尼日尔"},
  {"id": "NP", "code": "+977", "name": "尼泊尔"},
  {"id": "PS", "code": "+970", "name": "巴勒斯坦"},
  {"id": "BS", "code": "+1", "name": "巴哈马"},
  {"id": "PK", "code": "+92", "name": "巴基斯坦"},
  {"id": "BB", "code": "+1", "name": "巴巴多斯"},
  {"id": "PG", "code": "+675", "name": "巴布亚新几内亚"},
  {"id": "PY", "code": "+595", "name": "巴拉圭"},
  {"id": "PA", "code": "+507", "name": "巴拿马"},
  {"id": "BH", "code": "+973", "name": "巴林"},
  {"id": "BR", "code": "+55", "name": "巴西"},
  {"id": "BF", "code": "+226", "name": "布基纳法索"},
  {"id": "BI", "code": "+257", "name": "布隆迪"},
  {"id": "GR", "code": "+30", "name": "希腊"},
  {"id": "PW", "code": "+680", "name": "帕劳"},
  {"id": "CK", "code": "+682", "name": "库克群岛"},
  {"id": "KY", "code": "+1", "name": "开曼群岛"},
  {"id": "DE", "code": "+49", "name": "德国"},
  {"id": "IT", "code": "+39", "name": "意大利"},
  {"id": "SB", "code": "+677", "name": "所罗门群岛"},
  {"id": "TK", "code": "+690", "name": "托克劳"},
  {"id": "LV", "code": "+371", "name": "拉脱维亚"},
  {"id": "NO", "code": "+47", "name": "挪威"},
  {"id": "CZ", "code": "+420", "name": "捷克共和国"},
  {"id": "MD", "code": "+373", "name": "摩尔多瓦"},
  {"id": "MA", "code": "+212", "name": "摩洛哥"},
  {"id": "MC", "code": "+377", "name": "摩纳哥"},
  {"id": "BN", "code": "+673", "name": "文莱达鲁萨兰国"},
  {"id": "FJ", "code": "+679", "name": "斐济"},
  {"id": "SZ", "code": "+268", "name": "斯威士兰"},
  {"id": "SK", "code": "+421", "name": "斯洛伐克"},
  {"id": "SI", "code": "+386", "name": "斯洛文尼亚"},
  {"id": "LK", "code": "+94", "name": "斯里兰卡"},
  {"id": "SG", "code": "+65", "name": "新加坡"},
  {"id": "NC", "code": "+687", "name": "新喀里多尼亚"},
  {"id": "NZ", "code": "+64", "name": "新西兰"},
  {"id": "JP", "code": "+81", "name": "日本"},
  {"id": "CL", "code": "+56", "name": "智利"},
  {"id": "KH", "code": "+855", "name": "柬埔寨"},
  {"id": "GG", "code": "+44", "name": "根西"},
  {"id": "GD", "code": "+1", "name": "格林纳达"},
  {"id": "GL", "code": "+299", "name": "格陵兰"},
  {"id": "GE", "code": "+995", "name": "格鲁吉亚"},
  {"id": "BE", "code": "+32", "name": "比利时"},
  {"id": "MR", "code": "+222", "name": "毛里塔尼亚"},
  {"id": "MU", "code": "+230", "name": "毛里求斯"},
  {"id": "TO", "code": "+676", "name": "汤加"},
  {"id": "SA", "code": "+966", "name": "沙特阿拉伯"},
  {"id": "FR", "code": "+33", "name": "法国"},
  {"id": "GF", "code": "+594", "name": "法属圭亚那"},
  {"id": "PF", "code": "+689", "name": "法属波利尼西亚"},
  {"id": "FO", "code": "+298", "name": "法罗群岛"},
  {"id": "PL", "code": "+48", "name": "波兰"},
  {"id": "PR", "code": "+1", "name": "波多黎各"},
  {"id": "BA", "code": "+387", "name": "波斯尼亚和黑塞哥维那"},
  {"id": "TH", "code": "+66", "name": "泰国"},
  {"id": "JE", "code": "+44", "name": "泽西岛"},
  {"id": "ZW", "code": "+263", "name": "津巴布韦"},
  {"id": "HN", "code": "+504", "name": "洪都拉斯"},
  {"id": "HT", "code": "+509", "name": "海地"},
  {"id": "AU", "code": "+61", "name": "澳大利亚"},
  {"id": "MO", "code": "+853", "name": "澳门"},
  {"id": "IE", "code": "+353", "name": "爱尔兰"},
  {"id": "EE", "code": "+372", "name": "爱沙尼亚"},
  {"id": "JM", "code": "+1", "name": "牙买加"},
  {"id": "TC", "code": "+1", "name": "特克斯和凯科斯群岛"},
  {"id": "TT", "code": "+1", "name": "特立尼达和多巴哥"},
  {"id": "BO", "code": "+591", "name": "玻利维亚"},
  {"id": "NR", "code": "+674", "name": "瑙鲁"},
  {"id": "SE", "code": "+46", "name": "瑞典"},
  {"id": "CH", "code": "+41", "name": "瑞士"},
  {"id": "GP", "code": "+590", "name": "瓜德罗普"},
  {"id": "WF", "code": "+681", "name": "瓦利斯和富图纳"},
  {"id": "VU", "code": "+678", "name": "瓦努阿图"},
  {"id": "RE", "code": "+262", "name": "留尼汪"},
  {"id": "BY", "code": "+375", "name": "白俄罗斯"},
  {"id": "BM", "code": "+1", "name": "百慕大"},
  {"id": "GI", "code": "+350", "name": "直布罗陀"},
  {"id": "FK", "code": "+500", "name": "福克兰群岛（马尔维纳斯）"},
  {"id": "KW", "code": "+965", "name": "科威特"},
  {"id": "KM", "code": "+269", "name": "科摩罗"},
  {"id": "CI", "code": "+225", "name": "科特迪瓦"},
  {"id": "XK", "code": "+383", "name": "科索沃"},
  {"id": "PE", "code": "+51", "name": "秘鲁"},
  {"id": "TN", "code": "+216", "name": "突尼斯"},
  {"id": "LT", "code": "+370", "name": "立陶宛"},
  {"id": "SO", "code": "+252", "name": "索马里"},
  {"id": "JO", "code": "+962", "name": "约旦"},
  {"id": "NA", "code": "+264", "name": "纳米比亚"},
  {"id": "NU", "code": "+683", "name": "纽埃"},
  {"id": "MM", "code": "+95", "name": "缅甸"},
  {"id": "RO", "code": "+40", "name": "罗马尼亚"},
  {"id": "VI", "code": "+1", "name": "美属维尔京群岛"},
  {"id": "AS", "code": "+1", "name": "美属萨摩亚"},
  {"id": "LA", "code": "+856", "name": "老挝"},
  {"id": "KE", "code": "+254", "name": "肯尼亚"},
  {"id": "FI", "code": "+358", "name": "芬兰"},
  {"id": "SD", "code": "+249", "name": "苏丹"},
  {"id": "SR", "code": "+597", "name": "苏里南"},
  {"id": "GB", "code": "+44", "name": "英国"},
  {"id": "IO", "code": "+246", "name": "英属印度洋领地"},
  {"id": "VG", "code": "+1", "name": "英属维尔京群岛"},
  {"id": "NL", "code": "+31", "name": "荷兰"},
  {"id": "MZ", "code": "+258", "name": "莫桑比克"},
  {"id": "LS", "code": "+266", "name": "莱索托"},
  {"id": "PH", "code": "+63", "name": "菲律宾"},
  {"id": "SV", "code": "+503", "name": "萨尔瓦多"},
  {"id": "WS", "code": "+685", "name": "萨摩亚"},
  {"id": "PT", "code": "+351", "name": "葡萄牙"},
  {"id": "MN", "code": "+976", "name": "蒙古"},
  {"id": "MS", "code": "+1", "name": "蒙特塞拉特"},
  {"id": "ES", "code": "+34", "name": "西班牙"},
  {"id": "NF", "code": "+672", "name": "诺福克岛"},
  {"id": "BJ", "code": "+229", "name": "贝宁"},
  {"id": "ZM", "code": "+260", "name": "赞比亚"},
  {"id": "GQ", "code": "+240", "name": "赤道几内亚"},
  {"id": "VN", "code": "+84", "name": "越南"},
  {"id": "AZ", "code": "+994", "name": "阿塞拜疆"},
  {"id": "AF", "code": "+93", "name": "阿富汗"},
  {"id": "DZ", "code": "+213", "name": "阿尔及利亚"},
  {"id": "AL", "code": "+355", "name": "阿尔巴尼亚"},
  {"id": "AE", "code": "+971", "name": "阿拉伯联合酋长国"},
  {"id": "OM", "code": "+968", "name": "阿曼"},
  {"id": "AR", "code": "+54", "name": "阿根廷"},
  {"id": "AW", "code": "+297", "name": "阿鲁巴"},
  {"id": "KR", "code": "+82", "name": "韩国"},
  {"id": "HK", "code": "+852", "name": "香港"},
  {"id": "MV", "code": "+960", "name": "马尔代夫"},
  {"id": "MW", "code": "+265", "name": "马拉维"},
  {"id": "MQ", "code": "+596", "name": "马提尼克"},
  {"id": "MY", "code": "+60", "name": "马来西亚"},
  {"id": "YT", "code": "+262", "name": "马约特"},
  {"id": "MH", "code": "+692", "name": "马绍尔群岛"},
  {"id": "MT", "code": "+356", "name": "马耳他"},
  {"id": "MG", "code": "+261", "name": "马达加斯加"},
  {"id": "ML", "code": "+223", "name": "马里"},
  {"id": "LB", "code": "+961", "name": "黎巴嫩"},
  {"id": "ME", "code": "+382", "name": "黑山"}
];
// endregion

const {t, locale} = useI18n()

// 使用浏览器内置的 Intl.DisplayNames API 自动翻译国家/地区名称
const localizedPhoneCountryCodes = computed(() => {
  try {
    const regionNames = new Intl.DisplayNames([locale.value], {type: 'region'})
    return phoneCountryCodes.map(item => ({
      ...item,
      name: regionNames.of(item.id) || item.name // 如果系统接口转换失败，回退到原本硬编码的名称
    }))
  } catch (e) {
    return phoneCountryCodes
  }
})

// --- 手机号对话框的 Promise 封装 ---
let phoneResolve: ((val: { code: string, number: string } | null) => void) | null = null;

const showPhoneDialog = () => {
  currentData.phoneNumber = ''
  currentData.phoneDialogShowed = true
  return new Promise<{ code: string, number: string } | null>((resolve) => {
    phoneResolve = resolve
  })
}

const onPhoneConfirm = () => {
  if (!currentData.phoneNumber) {
    ElMessage.warning(t('setupNewAccount.phoneEmpty', 'Please input phone number'))
    return
  }
  currentData.phoneDialogShowed = false
  if (phoneResolve) {
    const country = phoneCountryCodes.find(i => i.id === currentData.phoneCountryId)
    phoneResolve({
      code: country?.code || '+86',
      number: currentData.phoneNumber
    })
    phoneResolve = null
  }
}

const onPhoneCancel = () => {
  currentData.phoneDialogShowed = false
  if (phoneResolve) {
    phoneResolve(null)
    phoneResolve = null
  }
}

const handleSetupNewAccount = () => {
  currentData.steamLoginModel = true
}

const handleNewAccountLoginSuccess = async (session: SteamSession) => {
  currentData.session = session
  await handleAuthentication()
}

const handleAuthentication = async () => {
  const loadingInstance = ElLoading.service({
    lock: true,
    text: t('setupNewAccount.loadingText'),
    background: 'rgba(0, 0, 0, 0.7)',
  })
  try {
    await addAuthenticator({})
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally {
    loadingInstance.close()
  }
}

const addAuthenticator = async (args: any) => {
  const state: TwoFactorState = await window.ipcRenderer.invoke('steam:addAuthenticator', {...currentData.session, ...args})
  if (!state) {
    ElMessage.error(t('setupNewAccount.addFailed', 'Add authenticator failed'))
    return
  }
  switch (state) {
      // 登录过期
    case "SessionExpired": {
      ElMessage.warning(t('steamLogin.loginFailedRetry', { result: 'Session Expired' }))
      currentData.steamLoginModel = true
      return
    }
    case "FailureRegisterDevice": {
      ElMessage.error(t('setupNewAccount.failureRegisterDevice', 'Failed to register device, please try again later.'))
      return
    }
    case "NeedChallengeSmsCode":
    case "BadChallengeSmsCode":
    case "AwaitingRemoveChallengeContinue": {
      if (state === "BadChallengeSmsCode") {
        ElMessage.error(t('setupNewAccount.badSmsCode', 'Incorrect SMS code'))
      }
      try {
        const smsCode = await showSmsCodeBox()
        return await addAuthenticator({ smsCode })
      } catch (e) {
        ElMessage.info(t('dialog.cancel'))
        return
      }
    }
    case "NeedPhoneNumber":{
      const phoneData = await showPhoneDialog()
      if (!phoneData) {
        ElMessage.info(t('dialog.cancel'))
        return
      }
      return await addAuthenticator({
        phoneNumber: phoneData.number,
        phoneCountryCode: phoneData.code
      })
    }
    case "Success": {
      ElMessage.success(t('setupNewAccount.addSuccess'))
      return
    }
    default: {
      ElMessage.info(t('setupNewAccount.unhandledState', `Unhandled state: ${state}`))
      return
    }
  }
}


const showSmsCodeBox = async () => {
  const resSmsCode: any = await ElMessageBox.prompt(t('setupNewAccount.smsCodePrompt'), t('setupNewAccount.smsCodeTitle'), {
    confirmButtonText: t('dialog.confirm'),
    cancelButtonText: t('dialog.cancel'),
    showClose: false,
    showCancelButton: true,
    buttonSize: 'small',
    closeOnClickModal: false,
    closeOnPressEscape: false,
    center: true,
    inputPattern: /^[a-zA-Z0-9]{5}$/,
    inputErrorMessage: t('steamLogin.fiveDigitCodeError')
  })
  return resSmsCode.value as string
}


const handleNewAccountLoginFailed = (err: any) => {
}

</script>

<template>
  <el-button @click="handleSetupNewAccount" size="small">{{ t('home.setupNewAccount') }}</el-button>

  <SteamLogin v-if="currentData.steamLoginModel" v-model:show="currentData.steamLoginModel"
              @success="handleNewAccountLoginSuccess" @failed="handleNewAccountLoginFailed"/>

  <CustomDialog 
      v-model:show="currentData.phoneDialogShowed" 
      :title="t('setupNewAccount.phoneTitle', 'Set Phone Number')"
      @confirm="onPhoneConfirm"
      @cancel="onPhoneCancel"
  >
    <el-input
        :placeholder="t('setupNewAccount.phonePlaceholder')"
        v-model="currentData.phoneNumber"
        size="small"
    >
      <template #prepend>
        <el-select
            size="small"
            v-model="currentData.phoneCountryId"
            placeholder="Country Code"
            filterable
            style="width: 100px"
        >
          <el-option
              v-for="item in localizedPhoneCountryCodes"
              :key="item.id"
              :label="`${item.name} (${item.code})`"
              :value="item.id"
          />
          <template #prefix>
            <span style="color: #409eff; font-weight: bold">
              {{ phoneCountryCodes.find(i => i.id === currentData.phoneCountryId)?.code }}
            </span>
          </template>
        </el-select>
      </template>
    </el-input>
  </CustomDialog>
</template>

<style scoped>

</style>

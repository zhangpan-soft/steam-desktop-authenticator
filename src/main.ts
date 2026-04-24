import {createApp} from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './style.css'
import router from "./router";
import { setupI18n } from './i18n'

async function bootstrap(){
    const settings = await window.ipcRenderer.invoke('settings:get');
    const i18n = setupI18n(settings.language);

    const app = createApp(App)
        .use(ElementPlus)
        .use(router)
        .use(i18n)

    app.mount('#app')
}

bootstrap().then()

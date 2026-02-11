import {createApp} from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './style.css'
import {initGlobalState} from "./utils/globalState.ts";
import router from "./router";

async function bootstrap(){
    await initGlobalState()
    await createApp(App)
        .use(ElementPlus)
        .use(router)
        .mount('#app').$nextTick(() => {
            // Use contextBridge
            window.ipcRenderer.on('main-process-message', (_event, message) => {
                console.log(message)
            })
        })
}

bootstrap().then()



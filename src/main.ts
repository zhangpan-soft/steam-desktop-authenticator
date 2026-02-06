import {createApp} from 'vue'
// import './style.css'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import {initGlobalState} from "./utils/globalState.ts";

async function bootstrap(){
    await initGlobalState()
    await createApp(App)
        .use(ElementPlus)
        .mount('#app').$nextTick(() => {
        // Use contextBridge
        window.ipcRenderer.on('main-process-message', (_event, message) => {
            console.log(message)
        })
    })
}

bootstrap().then()



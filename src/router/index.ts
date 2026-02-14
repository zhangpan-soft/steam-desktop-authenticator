import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: import('../views/HomeView.vue'),
    },
    {
      path: '/steam/confirmations',
      name: 'confirmations',
      component: import('../views/steam/Confirmations.vue'),
    },
    {
      path: '/steam/steamLogin',
      name: 'steamLogin',
      component: import('../views/steam/SteamLogin.vue')
    },
    {
      path: '/system/settings',
      name: 'Settings',
      component: import('../views/system/Settings.vue')
    },
    {
      path: '/system/initializing',
      name: 'Initializing',
      component: import('../views/system/Initializing.vue')
    },
    {
      path: '/system/unlock',
      name: 'Unlock',
      component: import('../views/system/Unlock.vue')
    }
  ]
})

export default router

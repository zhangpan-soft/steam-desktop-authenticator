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
      path: '/confirmations',
      name: 'confirmations',
      component: import('../views/steam/Confirmations.vue'),
    },
    {
      path: '/steamLogin',
      name: 'steamLogin',
      component: import('../views/steam/SteamLogin.vue')
    }
  ]
})

export default router

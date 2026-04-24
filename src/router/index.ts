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
      path: '/steam/cs2-inventory',
      name: 'cs2-inventory',
      component: import('../views/steam/Cs2Inventory.vue'),
    }
  ]
})

export default router

export default defineNuxtConfig({
  compatibilityDate: '2025-10-04',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  ssr: false,
  
  css: ['~/assets/css/main.css'],
  
  nitro: {
    preset: 'github_pages',
    output: { publicDir: 'docs' }
  },
 
  app: {
    baseURL: '/Bracedle/',
    buildAssetsDir: '_nuxt/', 
    head: {
      title: 'Bracedle',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },

  vite: {
    optimizeDeps: {
      include: ['tesseract.js']
    },
    build: {
      rollupOptions: {
        external: []
      }
    }
  }
})
export default defineNuxtConfig({
  compatibilityDate: '2025-10-04',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  ssr: false,
  nitro: { preset: 'github_pages' },
  app: {
    head: {
      title: 'Bracedle',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },
})
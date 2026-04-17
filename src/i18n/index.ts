import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'

// This function will be called in main.ts
export const setupI18n = (locale: 'en' | 'zh' = 'en') => {
    return createI18n({
        legacy: false, // must be false for composition API
        locale: locale,
        fallbackLocale: 'en',
        messages: {
            en,
            zh,
        },
        // Suppress warnings about missing translations during development
        silentTranslationWarn: true,
        silentFallbackWarn: true,
    });
}

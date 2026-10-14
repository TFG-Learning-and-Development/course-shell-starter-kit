// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

const verificationFixture = {
  name: 'course-verification-fixture',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      if (process.env.COURSE_VERIFY_COMPONENTS === '1') {
        injectRoute({
          pattern: '/__verify-components',
          entrypoint: new URL('./scripts/fixtures/ComponentFixture.astro', import.meta.url),
          prerender: true,
        });
        injectRoute({
          pattern: '/__verify-completion',
          entrypoint: new URL('./scripts/fixtures/CompletionFixture.astro', import.meta.url),
          prerender: true,
        });
      }
    },
  },
};

// https://astro.build/config
export default defineConfig({
  integrations: [verificationFixture],
  vite: {
    plugins: [tailwindcss()],
  },
});

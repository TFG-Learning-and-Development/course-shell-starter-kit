// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

const verificationFixture = {
  name: 'course-verification-fixture',
  hooks: {
    'astro:config:setup': ({ injectRoute, command }) => {
      if (command === 'dev') {
        injectRoute({
          pattern: '/__component-gallery',
          entrypoint: new URL('./scripts/fixtures/ComponentFixture.astro', import.meta.url),
          prerender: true,
        });
      }
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
        injectRoute({ pattern: '/__verify-large', entrypoint: new URL('./scripts/fixtures/LargeStateFixture.astro', import.meta.url), prerender: true });
        injectRoute({ pattern: '/__verify-interactions', entrypoint: new URL('./scripts/fixtures/InteractionStateFixture.astro', import.meta.url), prerender: true });
        injectRoute({ pattern: '/__verify-one-page', entrypoint: new URL('./scripts/fixtures/SinglePageFixture.astro', import.meta.url), prerender: true });
        injectRoute({ pattern: '/__verify-bad-contract', entrypoint: new URL('./scripts/fixtures/BadContractFixture.astro', import.meta.url), prerender: true });
        for (const pattern of ['/__verify-nav', '/__verify-nav/scenario/review']) {
          injectRoute({ pattern, entrypoint: new URL('./scripts/fixtures/NavigationFixture.astro', import.meta.url), prerender: true });
        }
        for (const pattern of ['/__verify-routes', '/__verify-routes-unlocked', '/__verify-routes-empty']) {
          injectRoute({ pattern, entrypoint: new URL('./scripts/fixtures/RouteFixture.astro', import.meta.url), prerender: true });
        }
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

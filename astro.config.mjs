import {defineConfig} from 'astro/config';
import react from '@astrojs/react';
export default defineConfig({site:process.env.PUBLIC_SITE_URL || 'https://stateside-expansion.up.railway.app',integrations:[react()],output:'static',trailingSlash:'always',vite:{server:{allowedHosts:true}}});

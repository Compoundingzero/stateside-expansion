import {defineConfig} from 'astro/config';
import react from '@astrojs/react';
export default defineConfig({site:process.env.PUBLIC_SITE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:3000'),integrations:[react()],output:'static',trailingSlash:'always',vite:{server:{allowedHosts:true}}});

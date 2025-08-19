import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import EnvironmentPlugin from 'vite-plugin-environment';
// https://vitejs.dev/config/
export default defineConfig({
    //base: '/eisegmi/',
    base: process.env.VITE_BASENAME || '/', // Usa la variable de entorno
    plugins: [
        react(),
        EnvironmentPlugin({ VITE_BASENAME: '/metalicos' })
        //EnvironmentPlugin({ VITE_BASENAME: '' })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});

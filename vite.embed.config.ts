// Construction en un seul fichier HTML (publication en artifact / partage hors-ligne)
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: { 'import.meta.env.VITE_EMBED': JSON.stringify('1') },
  build: { outDir: 'dist-single', emptyOutDir: true },
})

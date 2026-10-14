import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Pastas que não fazem parte do app: arquivos gravados nelas (prints,
    // relatórios de teste) não devem recarregar a página em desenvolvimento.
    watch: { ignored: ['**/docs/**', '**/.playwright-mcp/**', '**/tests/**'] },
  },
})

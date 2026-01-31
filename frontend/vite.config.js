import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/login': 'http://localhost:5000',
      '/sign_out': 'http://localhost:5000',
      '/locations': 'http://localhost:5000',
      '/usersdevices': 'http://localhost:5000',
      '/save_settings': 'http://localhost:5000',
      '/get_settings': 'http://localhost:5000',
      '/proxy': 'http://localhost:5000',
    }
  }
})

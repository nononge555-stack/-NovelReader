import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset URLs keep the build portable across GitHub Pages repository names.
  base: './',
  plugins: [react()],
});

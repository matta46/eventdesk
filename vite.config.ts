import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the whole app into a single dist/index.html so it can be hosted anywhere.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
});

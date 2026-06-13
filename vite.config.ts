import { defineConfig } from "vite";

export default defineConfig({
    base: "/idle-driller/",
    build: {
        target: "es2020",
        outDir: "dist",
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes("node_modules/phaser")) {
                        return "phaser";
                    }
                },
            },
        },
        chunkSizeWarningLimit: 500,
    },
});

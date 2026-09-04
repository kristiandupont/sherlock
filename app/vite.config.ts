import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // A GitHub project page is served from https://<user>.github.io/<repo>/, so a
  // build has to reference its assets under that prefix. This must match the
  // repository name. The dev server keeps serving from the root.
  base: command === "build" ? "/sherlock/" : "/",
}));

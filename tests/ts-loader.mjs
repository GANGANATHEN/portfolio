import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier === "next/server") {
      const candidate = path.resolve(process.cwd(), "node_modules/next/server.js");
      if (fs.existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    if (specifier.startsWith("@/")) {
      const resolvedPath = path.resolve(process.cwd(), "src", specifier.slice(2));
      for (const ext of [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"]) {
        const candidate = resolvedPath.endsWith(ext) ? resolvedPath : resolvedPath + ext;
        if (fs.existsSync(candidate)) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
    if (specifier.startsWith(".") || specifier.startsWith("/")) {
      const parentDir = context.parentURL
        ? path.dirname(fileURLToPath(context.parentURL))
        : process.cwd();
      const resolvedPath = path.resolve(parentDir, specifier);
      for (const ext of [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"]) {
        const candidate = resolvedPath.endsWith(ext) ? resolvedPath : resolvedPath + ext;
        if (fs.existsSync(candidate)) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
    throw err;
  }
}


import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".json"];

export async function resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier)) {
        for (const extension of SOURCE_EXTENSIONS) {
            const candidate = new URL(`${specifier}${extension}`, context.parentURL);
            try {
                await access(fileURLToPath(candidate));
                return { url: candidate.href, shortCircuit: true };
            } catch {
                // Keep trying the supported source extensions before delegating.
            }
        }
    }
    return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
    if (url.endsWith(".json")) {
        const json = await readFile(fileURLToPath(url), "utf8");
        return {
            format: "module",
            source: `export default ${json.trim()};`,
            shortCircuit: true,
        };
    }
    return nextLoad(url, context);
}

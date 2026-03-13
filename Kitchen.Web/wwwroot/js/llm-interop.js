// WebLLM interop — runs LLM inference in the browser via WebGPU/WASM
// Mirrors the pattern of ort-interop.js; no data leaves the device.

import * as webllm from "https://esm.run/@mlc-ai/web-llm";

const MODEL_ID = "SmolLM2-360M-Instruct-q4f16_1-MLC";

const PROMPT_TEMPLATE = `You are a practical chef. Given these ingredients: {ingredients}

Write ONE recipe. Use this exact format and stop after Tips:
## [Recipe Title]
**Ingredients:**
- [ingredient with quantity]
**Steps:**
1. [step]
**Tips:**
- [tip]`;

let engine = null;
let enginePromise = null;

async function getEngine() {
    if (engine) return engine;
    if (enginePromise) return enginePromise;

    enginePromise = webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => console.log(`[LLM] ${report.text}`),
    });

    engine = await enginePromise;
    enginePromise = null;
    return engine;
}

/**
 * Streams a recipe for the given ingredient list.
 * Calls dotnetCallback.OnToken(token) for each chunk,
 * OnComplete() when done, OnError(message) on failure.
 */
export async function streamRecipe(ingredients, dotnetCallback) {
    try {
        const eng = await getEngine();
        const prompt = PROMPT_TEMPLATE.replace("{ingredients}", ingredients.join(", "));

        const stream = await eng.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 512,
            frequency_penalty: 0.5,
            stream: true,
        });

        for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content;
            if (token) {
                await dotnetCallback.invokeMethodAsync("OnToken", token);
            }
        }

        await dotnetCallback.invokeMethodAsync("OnComplete");
    } catch (e) {
        console.error("[LLM] Error:", e);
        // Reset so the next attempt reinitialises (e.g. after GPU OOM)
        engine = null;
        enginePromise = null;
        await dotnetCallback.invokeMethodAsync("OnError", e?.message ?? String(e));
    }
}

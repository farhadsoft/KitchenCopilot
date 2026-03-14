// ONNX Runtime Web interop — runs inside a Web Worker to keep UI at 60 FPS
// WebGPU priority with WASM SIMD fallback

import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort.bundle.min.mjs';

ort.env.wasm.simd = true;
ort.env.wasm.proxy = false; // already inside a worker

let session = null;

async function loadModel() {
    if (session) return;
    session = await ort.InferenceSession.create('/models/food-detector.onnx', {
        executionProviders: ['webgpu', 'wasm'],
        graphOptimizationLevel: 'all',
    });
    console.log('[ORT] Food detector loaded. Inputs:', session.inputNames);
}

function iou(a, b) {
    const ax1 = a.cx - a.w / 2, ay1 = a.cy - a.h / 2, ax2 = a.cx + a.w / 2, ay2 = a.cy + a.h / 2;
    const bx1 = b.cx - b.w / 2, by1 = b.cy - b.h / 2, bx2 = b.cx + b.w / 2, by2 = b.cy + b.h / 2;
    const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
    const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
    const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
    return inter / (a.w * a.h + b.w * b.h - inter);
}

/**
 * Runs food ingredient detection on raw RGBA pixel data.
 * @param {number[]} rgbaPixels - Flat RGBA array from canvas.getImageData()
 * @param {number} width
 * @param {number} height
 * @returns {Promise<{label: string, confidence: number}[]>}
 */
export async function runInference(rgbaPixels, width, height) {
    await loadModel();

    // Convert RGBA → RGB float32 tensor, normalized [0,1], CHW layout
    const pixels = new Float32Array(3 * width * height);
    for (let i = 0; i < width * height; i++) {
        pixels[i]                      = rgbaPixels[i * 4]     / 255;
        pixels[i + width * height]     = rgbaPixels[i * 4 + 1] / 255;
        pixels[i + width * height * 2] = rgbaPixels[i * 4 + 2] / 255;
    }

    const tensor = new ort.Tensor('float32', pixels, [1, 3, height, width]);
    const feeds = { [session.inputNames[0]]: tensor };
    const results = await session.run(feeds);

    // YOLOv8 NMS-free output: [1, num_classes+4, num_anchors]
    const output = results[session.outputNames[0]].data;
    const numAnchors = results[session.outputNames[0]].dims[2];
    const numClasses = results[session.outputNames[0]].dims[1] - 4;

    const detections = [];
    const confidenceThreshold = 0.35;

    for (let i = 0; i < numAnchors; i++) {
        let maxScore = 0, maxClass = 0;
        for (let c = 0; c < numClasses; c++) {
            const score = output[(4 + c) * numAnchors + i];
            if (score > maxScore) { maxScore = score; maxClass = c; }
        }
        if (maxScore >= confidenceThreshold) {
            const cx = output[0 * numAnchors + i];
            const cy = output[1 * numAnchors + i];
            const w  = output[2 * numAnchors + i];
            const h  = output[3 * numAnchors + i];
            detections.push({ label: FOOD_CLASSES[maxClass] ?? `class_${maxClass}`, confidence: maxScore, cx, cy, w, h });
        }
    }

    // NMS: suppress overlapping boxes of the same class
    detections.sort((a, b) => b.confidence - a.confidence);
    const kept = [];
    for (const d of detections) {
        if (!kept.some(k => k.label === d.label && iou(k, d) > 0.45)) kept.push(d);
    }

    // Deduplicate: one entry per ingredient label (highest confidence wins)
    const byLabel = new Map();
    for (const d of kept) {
        if (!byLabel.has(d.label) || d.confidence > byLabel.get(d.label).confidence)
            byLabel.set(d.label, d);
    }

    return [...byLabel.values()]
        .filter(d => FOOD_FILTER.size === 0 || FOOD_FILTER.has(d.label))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 20)
        .map(({ label, confidence }) => ({ label, confidence }));
}

// Class labels — must match the model's training labels in index order.
// Current: YOLOv8n COCO (80 classes). Non-food detections are suppressed by FOOD_FILTER below.
// When switching to a food-specific model, replace this list with the model's data.yaml classes
// and remove FOOD_FILTER entirely.
const FOOD_CLASSES = [
    'person','bicycle','car','motorcycle','airplane','bus','train','truck','boat',
    'traffic light','fire hydrant','stop sign','parking meter','bench',
    'bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe',
    'backpack','umbrella','handbag','tie','suitcase','frisbee','skis','snowboard',
    'sports ball','kite','baseball bat','baseball glove','skateboard','surfboard',
    'tennis racket','bottle','wine glass','cup','fork','knife','spoon','bowl',
    'banana','apple','sandwich','orange','broccoli','carrot','hot dog','pizza',
    'donut','cake','chair','couch','potted plant','bed','dining table','toilet',
    'tv','laptop','mouse','remote','keyboard','cell phone','microwave','oven',
    'toaster','sink','refrigerator','book','clock','vase','scissors','teddy bear',
    'hair drier','toothbrush',
];

// Food-only allowlist — remove this when switching to a food-specific model
const FOOD_FILTER = new Set([
    'banana','apple','sandwich','orange','broccoli','carrot','hot dog','pizza',
    'donut','cake',
]);

// OpenCV.js loader for Flipdots. opencv.js (~10 MB, wasm inlined) is served
// untouched from /vendor/opencv.js — copied out of @techstark/opencv-js by
// scripts/vendor-opencv.mjs before dev/build — and injected as a <script>
// only once a camera is streaming: never on pages showing another logo, nor
// for visitors without a camera. It isn't bundled because Turbopack overflows
// its stack on the file's single ~10 MB line.
//
// The script defines window.cv: the emscripten Module, which is a THENABLE
// (Module.then calls back with Module itself). Any promise resolved WITH it —
// an async function returning it, `await`ing it — adopts the thenable, gets
// Module again, adopts that, and loops forever. So it is only ever handed out
// wrapped in a plain object.

/** The slice of OpenCV.js Flipdots uses (the package's own typings omit the
 * video module, BackgroundSubtractorMOG2 included) */
export interface Mat {
  data: Uint8Array;
  delete(): void;
}

export interface BackgroundSubtractorMOG2 {
  /** Updates the model with `image` and writes its foreground mask to
   * `fgmask`: 255 foreground, 127 shadow, 0 background. learningRate −1
   * picks it automatically (1 / min(frames seen, history)) */
  apply(image: Mat, fgmask: Mat, learningRate: number): void;
  delete(): void;
}

export interface OpenCv {
  Mat: new () => Mat;
  Size: new (width: number, height: number) => object;
  BackgroundSubtractorMOG2: new (
    history: number,
    varThreshold: number,
    detectShadows: boolean,
  ) => BackgroundSubtractorMOG2;
  matFromImageData(image: ImageData): Mat;
  cvtColor(src: Mat, dst: Mat, code: number): void;
  threshold(src: Mat, dst: Mat, thresh: number, maxval: number, type: number): number;
  getStructuringElement(shape: number, ksize: object): Mat;
  morphologyEx(src: Mat, dst: Mat, op: number, kernel: Mat): void;
  resize(src: Mat, dst: Mat, dsize: object, fx: number, fy: number, interpolation: number): void;
  COLOR_RGBA2RGB: number;
  THRESH_BINARY: number;
  MORPH_OPEN: number;
  MORPH_CLOSE: number;
  MORPH_ELLIPSE: number;
  INTER_AREA: number;
}

type Emscripten = OpenCv & { onRuntimeInitialized?: () => void };

const SRC = '/vendor/opencv.js';

let loading: Promise<{ cv: OpenCv }> | null = null;

/** Resolves once the wasm runtime is initialized; rejects if the script fails
 * to load. Cached: the runtime boots once per page, however often Flipdots
 * mounts */
export function loadOpenCv(): Promise<{ cv: OpenCv }> {
  if (loading) return loading;
  loading = new Promise<{ cv: OpenCv }>((resolve, reject) => {
    const whenReady = () => {
      const cv = (window as unknown as { cv?: Emscripten }).cv;
      if (!cv) {
        reject(new Error('opencv.js loaded without defining cv'));
      } else if (typeof cv.Mat === 'function') {
        resolve({ cv });
      } else {
        const previous = cv.onRuntimeInitialized;
        cv.onRuntimeInitialized = () => {
          previous?.();
          resolve({ cv });
        };
      }
    };
    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    script.onload = whenReady;
    script.onerror = () => reject(new Error(`failed to load ${SRC}`));
    document.head.appendChild(script);
  });
  // A failed load may be transient (offline); let the next mount retry
  loading.catch(() => { loading = null; });
  return loading;
}

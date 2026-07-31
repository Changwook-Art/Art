'use strict';

/*
 * PhotoSorter renderer
 * --------------------
 * Pipeline: load photos -> detect faces + compute 128-d descriptors ->
 * cluster descriptors (same face = same person) -> render groups ->
 * export each group into its own folder.
 *
 * All processing runs locally in this window. No image ever leaves the machine.
 */

// Distance below which a face is considered the same person as a cluster.
// Compared against the cluster's AVERAGE face (centroid linkage), so this can
// be tighter than a naive pairwise threshold while still keeping a person's
// varied shots together. Lower = stricter (purer groups). The user can fine-
// tune with a live slider.
const DEFAULT_THRESHOLD = 0.5;

// Downscale large photos before detection: faster, and plenty accurate for
// finding and encoding faces.
const MAX_DIM = 1024;

// Quality gate — faces failing these are ignored for clustering. Small,
// background, or blurry faces produce unreliable descriptors and are the main
// cause of wrong photos leaking into a person's folder.
const MIN_FACE_PX = 56;     // face box width on the (<=1024px) analysis canvas
const MIN_DET_SCORE = 0.55; // SSD detection confidence

// State
const state = {
  photos: [],       // [{ path, name }]
  faces: [],        // [{ photoPath, descriptor: Float32Array, crop: dataUrl }]
  clusters: [],     // [{ label, paths: string[], avatar: dataUrl }]
  noFace: [],       // photo paths with no detected face
  skipped: 0,       // low-quality faces dropped by the quality gate
  threshold: DEFAULT_THRESHOLD,
  analyzed: false,
  modelsReady: false,
};

// Elements
const el = {
  modelStatus: document.getElementById('modelStatus'),
  btnAddPhotos: document.getElementById('btnAddPhotos'),
  btnAddFolder: document.getElementById('btnAddFolder'),
  btnClear: document.getElementById('btnClear'),
  btnAnalyze: document.getElementById('btnAnalyze'),
  btnExport: document.getElementById('btnExport'),
  photoCount: document.getElementById('photoCount'),
  progressWrap: document.getElementById('progressWrap'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  dropzone: document.getElementById('dropzone'),
  preview: document.getElementById('preview'),
  previewGrid: document.getElementById('previewGrid'),
  previewTitle: document.getElementById('previewTitle'),
  results: document.getElementById('results'),
  resultsTitle: document.getElementById('resultsTitle'),
  resultsSub: document.getElementById('resultsSub'),
  grid: document.getElementById('grid'),
  thSlider: document.getElementById('thSlider'),
  thVal: document.getElementById('thVal'),
};

// ---------------------------------------------------------------------------
// Model loading
// ---------------------------------------------------------------------------
async function loadModels() {
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    state.modelsReady = true;
    el.modelStatus.textContent = '준비 완료';
    el.modelStatus.classList.add('ready');
    refreshButtons();
  } catch (e) {
    el.modelStatus.textContent = '모델 로딩 실패';
    el.modelStatus.classList.add('error');
    console.error('Model load failed:', e);
  }
}

// ---------------------------------------------------------------------------
// Photo intake
// ---------------------------------------------------------------------------
function addPhotoPaths(paths) {
  const known = new Set(state.photos.map((p) => p.path));
  for (const p of paths) {
    if (!known.has(p)) {
      known.add(p);
      state.photos.push({ path: p, name: p.split(/[\\/]/).pop() });
    }
  }
  // New photos invalidate previous analysis.
  state.analyzed = false;
  state.faces = [];
  state.clusters = [];
  state.noFace = [];
  updatePhotoCount();
  renderPreview();
  updateView();
  refreshButtons();
}

function updatePhotoCount() {
  el.photoCount.textContent = `사진 ${state.photos.length}장`;
}

// Decide which of the three panels is visible:
//  - no photos            -> drop hint
//  - photos, not analyzed -> loaded-photo preview
//  - analyzed             -> results
function updateView() {
  const hasPhotos = state.photos.length > 0;
  el.dropzone.hidden = hasPhotos;
  el.preview.hidden = !hasPhotos || state.analyzed;
  el.results.hidden = !state.analyzed;
}

// Show a thumbnail for every loaded photo so the user can confirm the import
// worked. Capped so a huge import doesn't create thousands of <img> nodes.
const PREVIEW_CAP = 60;
function renderPreview() {
  el.previewTitle.textContent = `불러온 사진 ${state.photos.length}장`;
  el.previewGrid.innerHTML = '';
  const shown = state.photos.slice(0, PREVIEW_CAP);
  for (const photo of shown) {
    const img = document.createElement('img');
    img.alt = photo.name;
    img.title = photo.name;
    getImage(photo.path).then((url) => { if (url) img.src = url; });
    el.previewGrid.appendChild(img);
  }
  if (state.photos.length > shown.length) {
    const more = document.createElement('div');
    more.className = 'more';
    more.textContent = `+${state.photos.length - shown.length}장 더`;
    el.previewGrid.appendChild(more);
  }
}

function refreshButtons() {
  const hasPhotos = state.photos.length > 0;
  el.btnAddPhotos.disabled = !state.modelsReady;
  el.btnAddFolder.disabled = !state.modelsReady;
  el.btnClear.disabled = !hasPhotos;
  el.btnAnalyze.disabled = !state.modelsReady || !hasPhotos;
  el.btnExport.disabled = !state.analyzed || state.clusters.length === 0;
}

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 열 수 없습니다.'));
    img.src = dataUrl;
  });
}

// Draw the image onto a canvas, downscaled so the longest side <= MAX_DIM.
function toCanvas(img) {
  let { width, height } = img;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  return canvas;
}

// Crop a square face thumbnail AND score its sharpness. The sharpness score
// (variance of the Laplacian) is high for crisp, in-focus faces and low for
// blurry/soft ones — we use it to pick the best-looking representative face
// for each person. `area` (face box area) is returned too so ties can prefer
// bigger, closer faces.
function faceCropAndSharpness(canvas, box, size = 112) {
  const pad = box.width * 0.2;
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  const w = Math.min(canvas.width - x, box.width + pad * 2);
  const h = Math.min(canvas.height - y, box.height + pad * 2);
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  ctx.drawImage(canvas, x, y, w, h, 0, 0, size, size);
  const crop = out.toDataURL('image/jpeg', 0.85);

  // Grayscale, then 3x3 Laplacian; variance of the response = sharpness.
  const { data } = ctx.getImageData(0, 0, size, size);
  const gray = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let yy = 1; yy < size - 1; yy++) {
    for (let xx = 1; xx < size - 1; xx++) {
      const i = yy * size + xx;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - size] - gray[i + size];
      sum += lap;
      sum2 += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  const sharpness = sum2 / n - mean * mean;
  return { crop, sharpness, area: box.width * box.height };
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------
async function analyze() {
  if (!state.modelsReady || state.photos.length === 0) return;

  setBusy(true);
  state.faces = [];
  state.noFace = [];
  state.skipped = 0; // low-quality faces dropped from clustering
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_DET_SCORE });

  for (let i = 0; i < state.photos.length; i++) {
    const photo = state.photos[i];
    setProgress((i) / state.photos.length, `얼굴 분석 중… (${i + 1}/${state.photos.length}) ${photo.name}`);
    try {
      const res = await window.api.readImage(photo.path);
      if (!res.ok) { state.noFace.push(photo.path); continue; }
      const img = await loadImage(res.dataUrl);
      const canvas = toCanvas(img);

      const detections = await faceapi
        .detectAllFaces(canvas, options)
        .withFaceLandmarks()
        .withFaceDescriptors();

      let kept = 0;
      for (const d of detections) {
        // Quality gate: skip small / low-confidence faces — their descriptors
        // are unreliable and pollute clusters.
        if (d.detection.box.width < MIN_FACE_PX || d.detection.score < MIN_DET_SCORE) {
          state.skipped++;
          continue;
        }
        const { crop, sharpness, area } = faceCropAndSharpness(canvas, d.detection.box);
        state.faces.push({
          photoPath: photo.path,
          descriptor: d.descriptor,
          crop,
          sharpness,
          area,
        });
        kept++;
      }
      if (kept === 0) state.noFace.push(photo.path);
    } catch (e) {
      console.warn('분석 실패:', photo.path, e);
      state.noFace.push(photo.path);
    }
    // Yield so the UI can repaint the progress bar.
    await new Promise((r) => setTimeout(r, 0));
  }

  setProgress(0.98, '인물별로 묶는 중…');
  state.clusters = clusterFaces(state.faces, state.threshold);
  state.analyzed = true;
  setBusy(false);
  setProgress(1, '완료');
  renderResults();
  refreshButtons();
}

// Two-stage clustering with CENTROID linkage (compares against a cluster's
// average face, not its nearest single member).
//
// Why centroid, not single-linkage: single-linkage lets one ambiguous face act
// as a "bridge" that chains two different people into one cluster — which is
// exactly how a stranger's photos leak into someone's folder. Comparing to the
// running average is far more robust: a face joins a cluster only if it's close
// to what that cluster looks like on the whole.
//
// Stage 1: assign each face to the nearest cluster centroid within `threshold`,
// else start a new cluster. Stage 2: merge clusters whose centroids are within
// `threshold` (recovers a person accidentally split by processing order).
function centroidOf(sum, count) {
  const m = new Float32Array(sum.length);
  for (let i = 0; i < sum.length; i++) m[i] = sum[i] / count;
  return m;
}

function clusterFaces(faces, threshold) {
  // cluster: { sum:Float32Array, count, mean, paths, crop, bestSharp, bestArea }
  const clusters = [];

  const addFace = (c, face) => {
    for (let i = 0; i < face.descriptor.length; i++) c.sum[i] += face.descriptor[i];
    c.count++;
    c.mean = centroidOf(c.sum, c.count);
    c.paths.add(face.photoPath);
    if (face.sharpness > c.bestSharp ||
        (face.sharpness === c.bestSharp && face.area > c.bestArea)) {
      c.crop = face.crop;
      c.bestSharp = face.sharpness;
      c.bestArea = face.area;
    }
  };

  // Stage 1 — nearest-centroid assignment.
  for (const face of faces) {
    let best = null;
    let bestDist = Infinity;
    for (const c of clusters) {
      const dist = faceapi.euclideanDistance(face.descriptor, c.mean);
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    if (best && bestDist < threshold) {
      addFace(best, face);
    } else {
      const sum = Float32Array.from(face.descriptor);
      clusters.push({
        sum,
        count: 1,
        mean: centroidOf(sum, 1),
        paths: new Set([face.photoPath]),
        crop: face.crop,
        bestSharp: face.sharpness,
        bestArea: face.area,
      });
    }
  }

  // Stage 2 — merge clusters whose centroids are within threshold.
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length && !merged; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (faceapi.euclideanDistance(clusters[i].mean, clusters[j].mean) < threshold) {
          const a = clusters[i];
          const b = clusters[j];
          for (let k = 0; k < a.sum.length; k++) a.sum[k] += b.sum[k];
          a.count += b.count;
          a.mean = centroidOf(a.sum, a.count);
          b.paths.forEach((p) => a.paths.add(p));
          if (b.bestSharp > a.bestSharp) {
            a.crop = b.crop;
            a.bestSharp = b.bestSharp;
            a.bestArea = b.bestArea;
          }
          clusters.splice(j, 1);
          merged = true;
          break;
        }
      }
    }
  }

  // Largest groups first, then label.
  clusters.sort((a, b) => b.paths.size - a.paths.size);
  return clusters.map((c, i) => ({
    label: `인물 ${i + 1}`,
    paths: Array.from(c.paths),
    avatar: c.crop,
  }));
}

// Re-run clustering from already-computed descriptors (no re-analysis) and
// repaint. Used by the live sensitivity slider.
function recluster() {
  if (!state.analyzed) return;
  state.clusters = clusterFaces(state.faces, state.threshold);
  renderResults();
  refreshButtons();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderResults() {
  updateView();
  el.grid.innerHTML = '';

  const totalPeople = state.clusters.length;
  const totalFaces = state.faces.length;
  el.resultsTitle.textContent = `${totalPeople}명의 인물을 찾았어요`;
  el.resultsSub.textContent =
    `사진 ${state.photos.length}장에서 얼굴 ${totalFaces}개 사용` +
    (state.skipped ? ` · 작거나 흐린 얼굴 ${state.skipped}개 제외` : '') +
    (state.noFace.length ? ` · 얼굴 없음/실패 ${state.noFace.length}장` : '') +
    ` · 슬라이더로 묶음을 조절하고 이름을 수정한 뒤 내보낼 수 있습니다.`;

  for (const cluster of state.clusters) {
    el.grid.appendChild(personCard(cluster));
  }

  if (state.noFace.length) {
    el.grid.appendChild(unsortedCard());
  }
}

function personCard(cluster) {
  const card = document.createElement('div');
  card.className = 'person-card';

  const head = document.createElement('div');
  head.className = 'person-head';

  const avatar = document.createElement('img');
  avatar.className = 'avatar';
  avatar.src = cluster.avatar;
  head.appendChild(avatar);

  const meta = document.createElement('div');
  meta.className = 'person-meta';

  const nameInput = document.createElement('input');
  nameInput.className = 'person-name';
  nameInput.value = cluster.label;
  nameInput.title = '클릭해서 이름 수정';
  nameInput.addEventListener('input', () => { cluster.label = nameInput.value; });
  meta.appendChild(nameInput);

  const count = document.createElement('div');
  count.className = 'person-count';
  count.textContent = `사진 ${cluster.paths.length}장`;
  meta.appendChild(count);

  head.appendChild(meta);
  card.appendChild(head);

  card.appendChild(thumbStrip(cluster.paths));
  return card;
}

function unsortedCard() {
  const card = document.createElement('div');
  card.className = 'person-card unsorted';

  const head = document.createElement('div');
  head.className = 'person-head';

  const avatar = document.createElement('div');
  avatar.className = 'avatar placeholder';
  avatar.textContent = '❔';
  head.appendChild(avatar);

  const meta = document.createElement('div');
  meta.className = 'person-meta';
  const name = document.createElement('div');
  name.className = 'person-name';
  name.textContent = '얼굴 없음 / 미분류';
  meta.appendChild(name);
  const count = document.createElement('div');
  count.className = 'person-count';
  count.textContent = `사진 ${state.noFace.length}장`;
  meta.appendChild(count);
  head.appendChild(meta);
  card.appendChild(head);

  card.appendChild(thumbStrip(state.noFace));
  return card;
}

// Cache decoded image data URLs by path so re-clustering (slider drags) does
// not re-read files from disk every time.
const imgCache = new Map();
function getImage(path) {
  if (imgCache.has(path)) return Promise.resolve(imgCache.get(path));
  return window.api.readImage(path).then((res) => {
    const url = res.ok ? res.dataUrl : null;
    imgCache.set(path, url);
    return url;
  });
}

// Show up to a few thumbnails; load them lazily via IPC (cached).
function thumbStrip(paths) {
  const wrap = document.createElement('div');
  wrap.className = 'thumbs';
  const shown = paths.slice(0, 5);
  for (const p of shown) {
    const img = document.createElement('img');
    img.alt = '';
    getImage(p).then((url) => { if (url) img.src = url; });
    wrap.appendChild(img);
  }
  if (paths.length > shown.length) {
    const more = document.createElement('div');
    more.className = 'more';
    more.textContent = `+${paths.length - shown.length}`;
    wrap.appendChild(more);
  }
  return wrap;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
async function exportClusters() {
  if (!state.analyzed) return;
  const outputDir = await window.api.pickOutput();
  if (!outputDir) return;

  const clusters = state.clusters.map((c) => ({ label: c.label, paths: c.paths }));
  if (state.noFace.length) {
    clusters.push({ label: '_미분류', paths: state.noFace });
  }

  setBusy(true);
  setProgress(0.5, '사진을 폴더로 복사 중…');
  const result = await window.api.exportClusters({ outputDir, clusters });
  setBusy(false);

  if (result.ok) {
    setProgress(1, `완료 · ${result.copied}장을 "${result.outputPath}" 에 저장했어요.`);
  } else {
    setProgress(1, `내보내기 실패: ${result.error}`);
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function setBusy(busy) {
  el.progressWrap.hidden = false;
  [el.btnAddPhotos, el.btnAddFolder, el.btnClear, el.btnAnalyze, el.btnExport].forEach((b) => {
    b.disabled = busy || b.disabled;
  });
  if (!busy) refreshButtons();
}

function setProgress(ratio, text) {
  el.progressFill.style.width = `${Math.round(ratio * 100)}%`;
  el.progressText.textContent = text || '';
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
el.btnAddPhotos.addEventListener('click', async () => {
  const paths = await window.api.pickPhotos();
  if (paths.length) addPhotoPaths(paths);
});

el.btnAddFolder.addEventListener('click', async () => {
  const paths = await window.api.pickFolder();
  if (paths.length) addPhotoPaths(paths);
});

el.btnClear.addEventListener('click', () => {
  state.photos = [];
  state.faces = [];
  state.clusters = [];
  state.noFace = [];
  state.skipped = 0;
  state.analyzed = false;
  el.progressWrap.hidden = true;
  updatePhotoCount();
  updateView();
  refreshButtons();
});

el.btnAnalyze.addEventListener('click', analyze);
el.btnExport.addEventListener('click', exportClusters);

// Live sensitivity slider: update the label immediately, and re-cluster once
// the user pauses (debounced) so dragging stays smooth.
let reclusterTimer = null;
el.thSlider.addEventListener('input', () => {
  state.threshold = Number(el.thSlider.value) / 100;
  el.thVal.textContent = state.threshold.toFixed(2);
  clearTimeout(reclusterTimer);
  reclusterTimer = setTimeout(recluster, 180);
});

// Drag & drop — accept photos dropped anywhere in the window, not just on the
// initial drop hint (which gets replaced by the preview once photos load).
['dragenter', 'dragover'].forEach((ev) =>
  document.addEventListener(ev, (e) => { e.preventDefault(); document.body.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach((ev) =>
  document.addEventListener(ev, (e) => {
    e.preventDefault();
    // Only clear the highlight when the cursor actually leaves the window.
    if (ev === 'drop' || !e.relatedTarget) document.body.classList.remove('dragover');
  })
);
document.addEventListener('drop', (e) => {
  if (!state.modelsReady) return;
  const paths = [];
  for (const f of e.dataTransfer.files) {
    // Electron exposes the absolute path on dropped File objects.
    if (f.path && /\.(jpe?g|png|webp|bmp)$/i.test(f.path)) paths.push(f.path);
  }
  if (paths.length) addPhotoPaths(paths);
});

// Kick off
loadModels();

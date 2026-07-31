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

// Distance below which two face descriptors are considered the same person.
// Lower = stricter (more, smaller groups). Higher = more lenient (fewer,
// bigger groups). Real event photos (varied light/angle/expression) need a
// looser value than the textbook 0.5, so we default a bit higher and let the
// user fine-tune with a live slider.
const DEFAULT_THRESHOLD = 0.58;

// Downscale large photos before detection: faster, and plenty accurate for
// finding and encoding faces.
const MAX_DIM = 1024;

// State
const state = {
  photos: [],       // [{ path, name }]
  faces: [],        // [{ photoPath, descriptor: Float32Array, crop: dataUrl }]
  clusters: [],     // [{ label, paths: string[], avatar: dataUrl }]
  noFace: [],       // photo paths with no detected face
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
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

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

      if (!detections.length) {
        state.noFace.push(photo.path);
        continue;
      }
      for (const d of detections) {
        const { crop, sharpness, area } = faceCropAndSharpness(canvas, d.detection.box);
        state.faces.push({
          photoPath: photo.path,
          descriptor: d.descriptor,
          crop,
          sharpness,
          area,
        });
      }
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

// Two-stage clustering.
//
// Stage 1 (greedy, single-linkage): walk faces once, dropping each into the
// nearest existing cluster if any member is within `threshold`, else start a
// new cluster. Fast, but order-dependent — the same person can end up split
// across several clusters depending on which face was seen first.
//
// Stage 2 (consolidation, average-linkage): repeatedly merge any two clusters
// whose *average* pairwise distance is within `threshold`, until stable. This
// stitches those accidental fragments back together. Average (not single)
// linkage here avoids "chaining" two different people together through one
// ambiguous face.
function clusterFaces(faces, threshold) {
  // Each cluster tracks its representative face = the sharpest one seen so far
  // (ties broken by larger face area). `best` holds that face's crop + score.
  const clusters = []; // { descriptors, paths, crop, bestSharp, bestArea }

  const isBetterRep = (face, c) =>
    face.sharpness > c.bestSharp ||
    (face.sharpness === c.bestSharp && face.area > c.bestArea);

  // Stage 1
  for (const face of faces) {
    let best = null;
    let bestDist = Infinity;
    for (const c of clusters) {
      let d = Infinity;
      for (const desc of c.descriptors) {
        const dist = faceapi.euclideanDistance(face.descriptor, desc);
        if (dist < d) d = dist;
      }
      if (d < bestDist) { bestDist = d; best = c; }
    }

    if (best && bestDist < threshold) {
      best.descriptors.push(face.descriptor);
      best.paths.add(face.photoPath);
      if (isBetterRep(face, best)) {
        best.crop = face.crop;
        best.bestSharp = face.sharpness;
        best.bestArea = face.area;
      }
    } else {
      clusters.push({
        descriptors: [face.descriptor],
        paths: new Set([face.photoPath]),
        crop: face.crop,
        bestSharp: face.sharpness,
        bestArea: face.area,
      });
    }
  }

  // Stage 2
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length && !merged; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (avgDistance(clusters[i].descriptors, clusters[j].descriptors) < threshold) {
          const a = clusters[i];
          const b = clusters[j];
          // Keep whichever cluster held the sharper representative face.
          if (b.bestSharp > a.bestSharp) {
            a.crop = b.crop;
            a.bestSharp = b.bestSharp;
            a.bestArea = b.bestArea;
          }
          a.descriptors.push(...b.descriptors);
          b.paths.forEach((p) => a.paths.add(p));
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

// Average pairwise distance between two descriptor sets (average linkage).
// Samples at most SAMPLE descriptors per side so big clusters stay cheap.
function avgDistance(a, b) {
  const SAMPLE = 8;
  const as = stride(a, SAMPLE);
  const bs = stride(b, SAMPLE);
  let sum = 0;
  let n = 0;
  for (const x of as) {
    for (const y of bs) { sum += faceapi.euclideanDistance(x, y); n++; }
  }
  return n ? sum / n : Infinity;
}

// Deterministic evenly-spaced sample of up to k items (no RNG).
function stride(arr, k) {
  if (arr.length <= k) return arr;
  const step = arr.length / k;
  const out = [];
  for (let i = 0; i < k; i++) out.push(arr[Math.floor(i * step)]);
  return out;
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
    `사진 ${state.photos.length}장에서 얼굴 ${totalFaces}개 검출` +
    (state.noFace.length ? ` · 얼굴 없음/실패 ${state.noFace.length}장` : '') +
    ` · 이름을 직접 수정한 뒤 내보낼 수 있습니다.`;

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

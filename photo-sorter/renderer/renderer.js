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
// Lower = stricter (more groups, fewer wrong merges). 0.5 is a good default
// for the face-api recognition model.
const MATCH_THRESHOLD = 0.5;

// Downscale large photos before detection: faster, and plenty accurate for
// finding and encoding faces.
const MAX_DIM = 1024;

// State
const state = {
  photos: [],       // [{ path, name }]
  faces: [],        // [{ photoPath, descriptor: Float32Array, crop: dataUrl }]
  clusters: [],     // [{ label, paths: string[], avatar: dataUrl }]
  noFace: [],       // photo paths with no detected face
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
  results: document.getElementById('results'),
  resultsTitle: document.getElementById('resultsTitle'),
  resultsSub: document.getElementById('resultsSub'),
  grid: document.getElementById('grid'),
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
  el.results.hidden = true;
  updatePhotoCount();
  refreshButtons();
}

function updatePhotoCount() {
  el.photoCount.textContent = `사진 ${state.photos.length}장`;
  el.dropzone.hidden = state.photos.length > 0 && (state.analyzed || false);
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

// Crop a square face thumbnail from the canvas given a face box.
function cropFace(canvas, box, size = 112) {
  const pad = box.width * 0.2;
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  const w = Math.min(canvas.width - x, box.width + pad * 2);
  const h = Math.min(canvas.height - y, box.height + pad * 2);
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  out.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, size, size);
  return out.toDataURL('image/jpeg', 0.8);
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
        state.faces.push({
          photoPath: photo.path,
          descriptor: d.descriptor,
          crop: cropFace(canvas, d.detection.box),
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
  state.clusters = clusterFaces(state.faces);
  state.analyzed = true;
  setBusy(false);
  setProgress(1, '완료');
  renderResults();
  refreshButtons();
}

// Greedy clustering: assign each face to the nearest existing cluster if it is
// within MATCH_THRESHOLD, otherwise start a new cluster.
function clusterFaces(faces) {
  const clusters = []; // { descriptors: Float32Array[], paths: Set, crop }

  for (const face of faces) {
    let best = null;
    let bestDist = Infinity;
    for (const c of clusters) {
      // Distance to a cluster = smallest distance to any of its members.
      let d = Infinity;
      for (const desc of c.descriptors) {
        const dist = faceapi.euclideanDistance(face.descriptor, desc);
        if (dist < d) d = dist;
        if (d < bestDist) break;
      }
      if (d < bestDist) { bestDist = d; best = c; }
    }

    if (best && bestDist < MATCH_THRESHOLD) {
      best.descriptors.push(face.descriptor);
      best.paths.add(face.photoPath);
    } else {
      clusters.push({
        descriptors: [face.descriptor],
        paths: new Set([face.photoPath]),
        crop: face.crop,
      });
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

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderResults() {
  el.dropzone.hidden = true;
  el.results.hidden = false;
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

// Show up to a few thumbnails; load them lazily via IPC.
function thumbStrip(paths) {
  const wrap = document.createElement('div');
  wrap.className = 'thumbs';
  const shown = paths.slice(0, 5);
  for (const p of shown) {
    const img = document.createElement('img');
    img.alt = '';
    window.api.readImage(p).then((res) => { if (res.ok) img.src = res.dataUrl; });
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
  el.results.hidden = true;
  el.dropzone.hidden = false;
  el.progressWrap.hidden = true;
  updatePhotoCount();
  refreshButtons();
});

el.btnAnalyze.addEventListener('click', analyze);
el.btnExport.addEventListener('click', exportClusters);

// Drag & drop
['dragenter', 'dragover'].forEach((ev) =>
  el.dropzone.addEventListener(ev, (e) => { e.preventDefault(); el.dropzone.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach((ev) =>
  el.dropzone.addEventListener(ev, (e) => { e.preventDefault(); el.dropzone.classList.remove('dragover'); })
);
el.dropzone.addEventListener('drop', (e) => {
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

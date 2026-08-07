#!/usr/bin/env node
/**
 * EU "Have Your Say" 의견수렴 데이터 수집 스크립트.
 *
 * hi-eco/topics.json 에서 active=true 인 주제를 읽어
 * EU 집행위 Better Regulation 공개 API(brpapi/searchInitiatives)를 조회하고,
 * 결과를 hi-eco/data/initiatives.json 으로 저장한다.
 *
 * 실행: node scripts/fetch_initiatives.mjs [--debug]
 * (Node 18+ 필요. GitHub Actions에서 매일 실행되도록 되어 있음)
 *
 * API 응답 스키마는 공식 문서가 없어 필드명이 바뀔 수 있으므로,
 * 여러 후보 필드명을 순서대로 시도하는 방어적 파싱을 사용한다.
 * 수집에 실패하면 기존 데이터 파일을 건드리지 않고 비정상 종료한다.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOPICS_FILE = join(ROOT, "hi-eco", "topics.json");
const OUT_FILE = join(ROOT, "hi-eco", "data", "initiatives.json");

const API_BASE =
  process.env.BRP_API_BASE ||
  "https://ec.europa.eu/info/law/better-regulation/brpapi/searchInitiatives";
const PAGE_SIZE = 50;
// 응답 정렬 순서를 신뢰할 수 없으므로 앞쪽/뒤쪽 페이지를 함께 수집한다.
const HEAD_PAGES = 3;
const TAIL_PAGES = 2;

const DEBUG = process.argv.includes("--debug");

function log(...args) {
  console.log("[fetch_initiatives]", ...args);
}

async function fetchJson(url, attempt = 1) {
  const MAX_ATTEMPTS = 4;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; hi-eco-dashboard/1.0; +https://github.com/Changwook-Art/Art)",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) throw err;
    const delay = 2000 * 2 ** (attempt - 1);
    log(`retry ${attempt}/${MAX_ATTEMPTS - 1} after ${delay}ms: ${err.message}`);
    await new Promise((r) => setTimeout(r, delay));
    return fetchJson(url, attempt + 1);
  }
}

/** 응답에서 initiative 배열을 찾는다 (_embedded 아래 키 이름이 바뀌어도 동작). */
function extractItems(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.content)) return json.content;
  const embedded = json?._embedded;
  if (embedded && typeof embedded === "object") {
    for (const value of Object.values(embedded)) {
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function firstString(...candidates) {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

/** "2026/08/06 23:59:59", ISO 문자열, epoch millis 를 모두 ISO 날짜로 정규화. */
function normalizeDate(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  const slash = s.match(/^(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (slash) {
    const [, y, m, d, hh = "12", mm = "00", ss = "00"] = slash;
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeTopics(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => {
      if (typeof t === "string") return t;
      if (t && typeof t === "object") return t.label || t.name || t.code || null;
      return null;
    })
    .filter(Boolean);
}

/** currentStatuses 등에서 의견수렴(피드백) 기간을 찾는다. */
function extractFeedback(item) {
  const statuses = [];
  for (const key of ["currentStatuses", "statuses", "publications"]) {
    if (Array.isArray(item?.[key])) statuses.push(...item[key]);
  }
  let start = null;
  let end = null;
  let open = false;
  // 열려 있는 피드백 기간을 우선하고, 없으면 가장 늦게 끝난 기간을 쓴다.
  for (const s of statuses) {
    const sStart = normalizeDate(s?.feedbackStartDate ?? s?.feedbackPeriodStart);
    const sEnd = normalizeDate(s?.feedbackEndDate ?? s?.feedbackPeriodEnd);
    const sOpen =
      String(s?.receivingFeedbackStatus ?? s?.feedbackStatus ?? "").toUpperCase() === "OPEN";
    if (sOpen) {
      if (!open || (sEnd && end && sEnd < end)) {
        start = sStart ?? start;
        end = sEnd ?? end;
      }
      open = true;
    } else if (!open && sEnd && (!end || sEnd > end)) {
      start = sStart;
      end = sEnd;
    }
  }
  start = start ?? normalizeDate(item?.feedbackStartDate);
  end = end ?? normalizeDate(item?.feedbackEndDate);
  return { feedbackStart: start, feedbackEnd: end, feedbackOpen: open };
}

function normalizeItem(item, topicCode) {
  const id = item?.id ?? item?.initiativeId ?? null;
  const title = firstString(
    item?.shortTitle,
    item?.initiativeTitle,
    item?.title,
    item?.dossierTitle,
    item?.betterRegulationTitle
  );
  if (id == null || !title) return null;
  const statuses = Array.isArray(item?.currentStatuses) ? item.currentStatuses : [];
  const stage = firstString(
    item?.frontEndStage,
    statuses[0]?.frontEndStage,
    item?.initiativeStatus,
    item?.stage
  );
  const published = normalizeDate(
    item?.publishedDate ?? item?.publicationDate ?? statuses[0]?.publishedDate ?? item?.modifiedDate
  );
  const { feedbackStart, feedbackEnd, feedbackOpen } = extractFeedback(item);
  return {
    id,
    title,
    reference: firstString(item?.reference) ?? null,
    actType: firstString(item?.foreseenActType, item?.actType) ?? null,
    stage: stage ?? null,
    topics: normalizeTopics(item?.topics),
    topicCodes: [topicCode],
    published,
    feedbackStart,
    feedbackEnd,
    feedbackOpen,
    url: `https://ec.europa.eu/info/law/better-regulation/have-your-say/initiatives/${id}`,
  };
}

// 주제 필터 파라미터 이름이 확실치 않으므로 여러 형식을 순서대로 시도한다.
const TOPIC_QUERY_VARIANTS = [
  (code, page) => `${API_BASE}?topic=${encodeURIComponent(code)}&size=${PAGE_SIZE}&page=${page}&language=EN`,
  (code, page) => `${API_BASE}?text=&topic=${encodeURIComponent(code)}&size=${PAGE_SIZE}&page=${page}&language=EN`,
  (code, page) => `${API_BASE}?topics=${encodeURIComponent(code)}&size=${PAGE_SIZE}&page=${page}&language=EN`,
];
const GLOBAL_QUERY_VARIANTS = [
  (page) => `${API_BASE}?size=${PAGE_SIZE}&page=${page}&language=EN`,
  (page) => `${API_BASE}?text=&size=${PAGE_SIZE}&page=${page}&language=EN`,
];

function pagesToFetch(totalPages, head, tail) {
  const pages = new Set([0]);
  for (let p = 1; p < Math.min(head, totalPages); p++) pages.add(p);
  for (let p = Math.max(0, totalPages - tail); p < totalPages; p++) pages.add(p);
  return [...pages].sort((a, b) => a - b);
}

async function collectPages(pageUrl, head, tail, collect) {
  const first = await fetchJson(pageUrl(0));
  const firstItems = extractItems(first);
  if (firstItems.length === 0) {
    // 0건이면 원인 파악을 위해 실제 응답을 로그로 남긴다.
    log(`empty response from ${pageUrl(0)}`);
    log(`raw body (truncated): ${JSON.stringify(first)?.slice(0, 1500)}`);
    return 0;
  }
  if (DEBUG) log(`raw sample:`, JSON.stringify(firstItems[0])?.slice(0, 2000));
  const totalPages = Number(first?.page?.totalPages ?? 1);
  let count = 0;
  for (const page of pagesToFetch(totalPages, head, tail)) {
    const json = page === 0 ? first : await fetchJson(pageUrl(page));
    for (const raw of extractItems(json)) {
      collect(raw);
      count++;
    }
  }
  return count;
}

/** 주제 필터 쿼리로 수집. 모든 형식이 0건이면 null 반환(전체 수집 폴백 필요). */
async function fetchTopic(code) {
  for (const variant of TOPIC_QUERY_VARIANTS) {
    const items = new Map();
    const got = await collectPages(
      (page) => variant(code, page),
      HEAD_PAGES,
      TAIL_PAGES,
      (raw) => {
        const item = normalizeItem(raw, code);
        if (item) items.set(item.id, item);
      }
    );
    if (got > 0) {
      log(`${code}: ${items.size} items`);
      return [...items.values()];
    }
  }
  log(`${code}: all topic-filtered queries returned 0 items`);
  return null;
}

/**
 * 폴백: 주제 필터 없이 전체 목록을 받아, 각 항목의 topics 라벨을
 * 활성 주제의 영어 이름과 대조해 직접 분류한다.
 */
async function fetchAllAndClassify(topics) {
  const labelToCode = new Map(topics.map((t) => [t.en.toLowerCase(), t.code]));
  const items = new Map();
  for (const variant of GLOBAL_QUERY_VARIANTS) {
    const got = await collectPages(variant, HEAD_PAGES * 2, TAIL_PAGES * 2, (raw) => {
      const codes = normalizeTopics(raw?.topics)
        .map((label) => labelToCode.get(String(label).toLowerCase()))
        .filter(Boolean);
      if (codes.length === 0) return;
      const item = normalizeItem(raw, codes[0]);
      if (!item) return;
      item.topicCodes = codes;
      const existing = items.get(item.id);
      if (existing) {
        existing.topicCodes = [...new Set([...existing.topicCodes, ...codes])];
      } else {
        items.set(item.id, item);
      }
    });
    if (got > 0) break;
  }
  log(`fallback (unfiltered fetch): ${items.size} items matched active topics`);
  return [...items.values()];
}

function sortKey(item) {
  // 진행 중 피드백은 마감 임박순으로 먼저, 나머지는 최신 공개순.
  if (item.feedbackOpen && item.feedbackEnd) return [0, item.feedbackEnd];
  return [1, item.published ? `~${item.published}` : "~~"];
}

async function main() {
  const topicsConfig = JSON.parse(await readFile(TOPICS_FILE, "utf8"));
  const active = topicsConfig.topics.filter((t) => t.active);
  if (active.length === 0) {
    console.error("No active topics in hi-eco/topics.json");
    process.exit(1);
  }
  log(`fetching topics: ${active.map((t) => t.code).join(", ")}`);

  const merged = new Map();
  const failures = [];
  const mergeItem = (item) => {
    const existing = merged.get(item.id);
    if (existing) {
      existing.topicCodes = [...new Set([...existing.topicCodes, ...item.topicCodes])];
    } else {
      merged.set(item.id, item);
    }
  };

  let needFallback = false;
  for (const topic of active) {
    try {
      const items = await fetchTopic(topic.code);
      if (items === null) {
        needFallback = true;
      } else {
        items.forEach(mergeItem);
      }
    } catch (err) {
      failures.push(topic.code);
      console.error(`Failed to fetch topic ${topic.code}: ${err.message}`);
    }
  }

  // 주제 필터 쿼리가 통하지 않으면 전체 목록을 받아 직접 분류한다.
  if (needFallback) {
    try {
      (await fetchAllAndClassify(active)).forEach(mergeItem);
    } catch (err) {
      console.error(`Fallback fetch failed: ${err.message}`);
    }
  }

  if (merged.size === 0) {
    console.error("No data collected — keeping the existing data file untouched.");
    process.exit(1);
  }
  if (failures.length > 0) {
    log(`warning: some topics failed (${failures.join(", ")}), continuing with partial data`);
  }

  const now = new Date();
  const initiatives = [...merged.values()].sort((a, b) => {
    const [ga, ka] = sortKey(a);
    const [gb, kb] = sortKey(b);
    if (ga !== gb) return ga - gb;
    return ga === 0 ? ka.localeCompare(kb) : kb.localeCompare(ka);
  });

  const openCount = initiatives.filter((i) => i.feedbackOpen).length;
  const output = {
    generatedAt: now.toISOString(),
    sample: false,
    source: "EU Have Your Say (ec.europa.eu/info/law/better-regulation)",
    topics: active.map(({ code, en, ko }) => ({ code, en, ko })),
    failedTopics: failures,
    counts: { total: initiatives.length, open: openCount },
    initiatives,
  };

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");
  log(`wrote ${initiatives.length} initiatives (${openCount} open) to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

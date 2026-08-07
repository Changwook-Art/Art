/* hi eco — EU 규제 의견수렴 대시보드 */

const DATA_URL = "data/initiatives.json";
const TOPICS_URL = "topics.json";
const CLOSING_SOON_DAYS = 7;

const state = {
    data: null,
    topicLabels: {},   // code -> 한글 라벨
    topic: "all",
    status: "open",
    query: "",
    sort: "deadline",
};

const $ = (id) => document.getElementById(id);

init();

async function init() {
    try {
        const [dataRes, topicsRes] = await Promise.all([
            fetch(DATA_URL, { cache: "no-cache" }),
            fetch(TOPICS_URL, { cache: "no-cache" }),
        ]);
        if (!dataRes.ok) throw new Error(`HTTP ${dataRes.status}`);
        state.data = await dataRes.json();
        if (topicsRes.ok) {
            const t = await topicsRes.json();
            for (const topic of t.topics || []) {
                state.topicLabels[topic.code] = topic.ko || topic.en || topic.code;
            }
        }
    } catch (err) {
        console.error("데이터 로드 실패:", err);
        $("error-notice").classList.remove("hidden");
        return;
    }

    if (state.data.sample) $("sample-notice").classList.remove("hidden");

    renderStats();
    renderTopicChips();
    bindControls();
    render();
}

/* ---------- 상태 판정 ---------- */

function daysLeft(item) {
    if (!item.feedbackEnd) return null;
    const end = new Date(item.feedbackEnd);
    if (Number.isNaN(end.getTime())) return null;
    return Math.ceil((end.getTime() - Date.now()) / 86400000);
}

function statusOf(item) {
    const d = daysLeft(item);
    const open = item.feedbackOpen && (d === null || d >= 0);
    if (open && d !== null && d <= CLOSING_SOON_DAYS) return "closing";
    if (open) return "open";
    return "closed";
}

/* ---------- 렌더링 ---------- */

function renderStats() {
    const items = state.data.initiatives || [];
    const open = items.filter((i) => statusOf(i) !== "closed");
    const closing = items.filter((i) => statusOf(i) === "closing");
    $("stat-open").textContent = String(open.length);
    $("stat-closing").textContent = String(closing.length);
    $("stat-total").textContent = String(items.length);
    $("stat-updated").textContent = formatDate(state.data.generatedAt) || "–";
}

function renderTopicChips() {
    const container = $("topic-chips");
    const codes = (state.data.topics || []).map((t) => t.code);
    const chips = [{ code: "all", label: "전체" }].concat(
        codes.map((code) => ({ code, label: state.topicLabels[code] || code }))
    );
    container.innerHTML = "";
    for (const { code, label } of chips) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip";
        btn.textContent = label;
        btn.setAttribute("aria-pressed", String(state.topic === code));
        btn.addEventListener("click", () => {
            state.topic = code;
            for (const c of container.children) c.setAttribute("aria-pressed", "false");
            btn.setAttribute("aria-pressed", "true");
            render();
        });
        container.appendChild(btn);
    }
}

function bindControls() {
    $("search-input").addEventListener("input", (e) => {
        state.query = e.target.value.trim().toLowerCase();
        render();
    });
    $("status-filter").addEventListener("change", (e) => {
        state.status = e.target.value;
        render();
    });
    $("sort-select").addEventListener("change", (e) => {
        state.sort = e.target.value;
        render();
    });
}

function filteredItems() {
    let items = (state.data.initiatives || []).slice();

    if (state.topic !== "all") {
        items = items.filter((i) => (i.topicCodes || []).includes(state.topic));
    }
    if (state.status !== "all") {
        items = items.filter((i) => {
            const s = statusOf(i);
            if (state.status === "open") return s === "open" || s === "closing";
            return s === state.status;
        });
    }
    if (state.query) {
        items = items.filter((i) =>
            [i.title, i.reference, ...(i.topics || [])]
                .filter(Boolean)
                .some((f) => f.toLowerCase().includes(state.query))
        );
    }

    items.sort((a, b) => {
        if (state.sort === "deadline") {
            const da = daysLeft(a), db = daysLeft(b);
            const oa = statusOf(a) !== "closed", ob = statusOf(b) !== "closed";
            if (oa !== ob) return oa ? -1 : 1;
            if (da === null && db === null) return cmpPublished(a, b);
            if (da === null) return 1;
            if (db === null) return -1;
            return da - db;
        }
        return cmpPublished(a, b);
    });
    return items;
}

function cmpPublished(a, b) {
    return (b.published || "").localeCompare(a.published || "");
}

function render() {
    const items = filteredItems();
    $("result-count").textContent = `${items.length}건 표시 중 (전체 ${state.data.initiatives.length}건)`;

    const list = $("card-list");
    list.innerHTML = "";

    if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "조건에 맞는 항목이 없습니다. 필터를 바꿔보세요.";
        list.appendChild(empty);
        return;
    }

    for (const item of items) list.appendChild(renderCard(item));
}

const STATUS_META = {
    open:    { cls: "status-open",    icon: "●", label: "의견수렴 진행 중" },
    closing: { cls: "status-closing", icon: "⏰", label: "마감 임박" },
    closed:  { cls: "status-closed",  icon: "—", label: "종료·예정" },
};

function renderCard(item) {
    const card = document.createElement("article");
    card.className = "card";

    const status = statusOf(item);
    const meta = STATUS_META[status];
    const d = daysLeft(item);

    const top = document.createElement("div");
    top.className = "card-top";

    const badge = document.createElement("span");
    badge.className = `status-badge ${meta.cls}`;
    badge.textContent = `${meta.icon} ${meta.label}`;
    top.appendChild(badge);

    if (status !== "closed" && d !== null) {
        const dday = document.createElement("span");
        dday.className = "dday" + (d > CLOSING_SOON_DAYS ? " dday-far" : "");
        dday.textContent = d === 0 ? "오늘 마감" : `D-${d}`;
        top.appendChild(dday);
    }
    card.appendChild(top);

    const h3 = document.createElement("h3");
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = item.title;
    h3.appendChild(link);
    card.appendChild(h3);

    const metaRow = document.createElement("div");
    metaRow.className = "card-meta";
    for (const code of item.topicCodes || []) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = `#${state.topicLabels[code] || code}`;
        metaRow.appendChild(tag);
    }
    if (item.actType) metaRow.appendChild(textSpan(item.actType));
    if (item.stage) metaRow.appendChild(textSpan(stageLabel(item.stage)));
    if (item.reference) metaRow.appendChild(textSpan(item.reference));
    card.appendChild(metaRow);

    const dates = document.createElement("div");
    dates.className = "card-dates";
    if (item.feedbackStart || item.feedbackEnd) {
        dates.appendChild(
            textSpan(`의견수렴: ${formatDate(item.feedbackStart) || "?"} ~ ${formatDate(item.feedbackEnd) || "?"}`)
        );
    }
    if (item.published) dates.appendChild(textSpan(`공개: ${formatDate(item.published)}`));

    const go = document.createElement("a");
    go.className = "card-link";
    go.href = item.url;
    go.target = "_blank";
    go.rel = "noopener";
    go.textContent = status === "closed" ? "자세히 보기 →" : "의견 제출하기 →";
    dates.appendChild(go);
    card.appendChild(dates);

    return card;
}

function textSpan(text) {
    const span = document.createElement("span");
    span.textContent = text;
    return span;
}

const STAGE_LABELS = {
    OPC_LAUNCHED: "공공협의 진행",
    OPEN_PUBLIC_CONSULTATION: "공공협의",
    CALL_FOR_EVIDENCE: "의견요청서(Call for evidence)",
    ROADMAP: "로드맵",
    INCEPTION_IMPACT_ASSESSMENT: "영향평가 초기",
    PROPOSAL_FOR_REGULATION: "법안 제안",
    COMMISSION_ADOPTION: "집행위 채택",
    DELEGATED_ACT: "위임입법",
    IMPLEMENTING_ACT: "이행입법",
    DRAFT_ACT: "법안 초안",
    ADOPTED: "채택 완료",
};

function stageLabel(stage) {
    if (!stage) return "";
    return STAGE_LABELS[stage] || stage.replaceAll("_", " ").toLowerCase();
}

function formatDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/* reg-lab-finder — 대시보드 로직 */
(function () {
    "use strict";

    const LS_PRODUCT = "regLabFinder.product.v1";
    const LS_MAPPINGS = "regLabFinder.mappings.v1";

    const $ = (sel) => document.querySelector(sel);

    function esc(s) {
        return String(s ?? "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[c]));
    }

    /* ---------- 탭 ---------- */
    document.querySelectorAll(".tab").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", "false"));
            btn.setAttribute("aria-selected", "true");
            document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
            $("#panel-" + btn.dataset.tab).classList.remove("hidden");
        });
    });

    /* ---------- 제품 입력 폼 ---------- */
    function loadProduct() {
        try { return JSON.parse(localStorage.getItem(LS_PRODUCT)) || {}; }
        catch { return {}; }
    }

    function readForm() {
        return {
            name: $("#f-name").value.trim(),
            desc: $("#f-desc").value.trim(),
            focus: $("#f-focus").value.trim(),
            etc: $("#f-etc").value.trim(),
            markets: [...document.querySelectorAll('#f-markets input:checked')].map((i) => i.value),
            flags: [...document.querySelectorAll('#f-flags input:checked')].map((i) => i.value),
        };
    }

    function renderCheckChips(containerId, items, checkedIds) {
        $(containerId).innerHTML = items.map((it) => `
            <label class="check-chip">
                <input type="checkbox" value="${it.id}" ${checkedIds.includes(it.id) ? "checked" : ""}>
                ${esc(it.label)}
            </label>`).join("");
    }

    function initForm() {
        const saved = loadProduct();
        $("#f-name").value = saved.name || "";
        $("#f-desc").value = saved.desc || "";
        $("#f-focus").value = saved.focus || "";
        $("#f-etc").value = saved.etc || "";
        renderCheckChips("#f-markets", REG_DATA.markets, saved.markets || ["EU", "KR"]);
        renderCheckChips("#f-flags", REG_DATA.flags, saved.flags || ["electronic"]);
        $("#product-form").addEventListener("input", onFormChange);
        onFormChange();
    }

    function onFormChange() {
        const p = readForm();
        localStorage.setItem(LS_PRODUCT, JSON.stringify(p));
        renderMatchedRegs(p);
        renderPrompt(p);
    }

    /* ---------- 규제 매칭 (ASSUMPTION — 참고용 규칙 매칭) ---------- */
    function matchRegs(p) {
        return REG_DATA.regulations.filter((r) => {
            if (!r.match.markets.some((m) => p.markets.includes(m))) return false;
            if (r.match.anyFlags.length === 0) return true;
            return r.match.anyFlags.some((f) => p.flags.includes(f));
        });
    }

    const NEED_LABEL = {
        self: "자기평가 가능",
        common: "시험이 일반적 입증방법",
        third: "제3자 시험 필수",
        conditional: "조건부 (확인 필요)",
    };

    function renderMatchedRegs(p) {
        const el = $("#matched-regs");
        if (p.markets.length === 0) {
            el.innerHTML = '<p class="empty-state">대상 시장을 선택하면 적용 가능성 있는 규제가 표시됩니다.</p>';
            return;
        }
        const regs = matchRegs(p);
        if (regs.length === 0) {
            el.innerHTML = '<p class="empty-state">선택한 조건과 매칭되는 규제가 라이브러리에 없습니다. 프롬프트로 심층 조사를 진행하세요.</p>';
            return;
        }
        el.innerHTML = regs.map((r) => `
            <div class="matched-reg">
                <strong>${esc(r.name)}</strong>
                <span class="need-badge need-${r.testNeed}">${NEED_LABEL[r.testNeed]}</span>
                <span class="need">${esc(r.lawRef)}</span>
                <a href="${esc(r.links[0].url)}" target="_blank" rel="noopener">원문 ↗</a>
            </div>`).join("");
    }

    /* ---------- 프롬프트 생성 ---------- */
    function renderPrompt(p) {
        const marketLabels = p.markets
            .map((id) => (REG_DATA.markets.find((m) => m.id === id) || {}).label || id)
            .map((s) => s.replace(/^\S+\s/, ""));
        const flagLabels = p.flags
            .map((id) => (REG_DATA.flags.find((f) => f.id === id) || {}).label || id);
        const matched = p.markets.length ? matchRegs(p).map((r) => r.name) : [];

        $("#prompt-output").value = [
            "다음 제품에 대해 「규제 요구사항별 시험·검사기관 탐색」 조사를 수행하라.",
            "(스킬 /reg-lab-finder 적용 — 규제 → 요구사항 → 시험·검사 → 시험표준 → 기관 자격 → 인정 Scope 순서로 검증하고,",
            " 모든 판단을 FACT / INTERPRETATION / ASSUMPTION / UNVERIFIED와 확인 / 부분확인 / 미확인으로 구분할 것)",
            "",
            `■ 제품명: ${p.name || "(미입력)"}`,
            `■ 제품 설명: ${p.desc || "(미입력)"}`,
            `■ 대상 국가/시장: ${marketLabels.join(", ") || "(미입력)"}`,
            `■ 제품 특성: ${flagLabels.join(", ") || "(해당 없음)"}`,
            `■ 확인 대상 규제: ${matched.length ? matched.join(", ") + " (대시보드 규칙 매칭 결과 — 누락 규제 자동 식별 요망)" : "자동 식별"}`,
            `■ 특히 확인하고 싶은 요구사항: ${p.focus || "(없음)"}`,
            "■ 국내기관 우선 여부: 예",
            "■ 해외 시험기관 포함 여부: 예 (국내 수행 불가 시)",
            `■ 기타 조건: ${p.etc || "(없음)"}`,
        ].join("\n");
    }

    $("#copy-prompt").addEventListener("click", async () => {
        const btn = $("#copy-prompt");
        try {
            await navigator.clipboard.writeText($("#prompt-output").value);
            btn.textContent = "✅ 복사됨";
        } catch {
            $("#prompt-output").select();
            document.execCommand("copy");
            btn.textContent = "✅ 복사됨";
        }
        setTimeout(() => { btn.textContent = "📋 프롬프트 복사"; }, 1500);
    });

    /* ---------- 규제 라이브러리 ---------- */
    let libMarket = "all";

    function initLibrary() {
        const chips = [{ id: "all", label: "전체" }, ...REG_DATA.markets];
        $("#lib-market-chips").innerHTML = chips.map((c) =>
            `<button type="button" class="chip" data-market="${c.id}" aria-pressed="${c.id === "all"}">${esc(c.label)}</button>`
        ).join("");
        $("#lib-market-chips").addEventListener("click", (e) => {
            const btn = e.target.closest(".chip");
            if (!btn) return;
            libMarket = btn.dataset.market;
            document.querySelectorAll("#lib-market-chips .chip").forEach((b) =>
                b.setAttribute("aria-pressed", String(b === btn)));
            renderLibrary();
        });
        $("#lib-search").addEventListener("input", renderLibrary);
        renderLibrary();
    }

    function renderLibrary() {
        const q = $("#lib-search").value.trim().toLowerCase();
        const regs = REG_DATA.regulations.filter((r) => {
            if (libMarket !== "all" && r.market !== libMarket) return false;
            if (!q) return true;
            const hay = [r.name, r.lawRef, r.summary,
                ...r.requirements.flatMap((x) => [x.name, x.standards, x.testItems])].join(" ").toLowerCase();
            return hay.includes(q);
        });
        const marketLabel = (id) => (REG_DATA.markets.find((m) => m.id === id) || {}).label || id;

        $("#reg-cards").innerHTML = regs.length === 0
            ? '<p class="empty-state">검색 결과가 없습니다.</p>'
            : regs.map((r) => `
            <article class="card">
                <div class="card-top">
                    <span class="market-badge">${esc(marketLabel(r.market))}</span>
                    <h3>${esc(r.name)}</h3>
                    <span class="need-badge need-${r.testNeed}">${NEED_LABEL[r.testNeed]}</span>
                </div>
                <p class="card-law">${esc(r.lawRef)} · ${esc(r.testNeedLabel)}</p>
                <p class="card-summary">${esc(r.summary)}</p>
                <div class="table-wrap">
                    <table class="req-table">
                        <thead><tr>
                            <th>요구사항</th><th>내용</th><th>시험·검사항목</th><th>적용 표준</th><th>장비·방법</th><th>요구 기관 자격</th>
                        </tr></thead>
                        <tbody>${r.requirements.map((x) => `
                            <tr>
                                <td>${esc(x.name)}</td>
                                <td>${esc(x.detail)}</td>
                                <td>${esc(x.testItems)}</td>
                                <td>${esc(x.standards)}</td>
                                <td>${esc(x.methods)}</td>
                                <td>${esc(x.bodyQual)}</td>
                            </tr>`).join("")}
                        </tbody>
                    </table>
                </div>
                <div class="card-links">
                    ${r.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener"><span class="src-grade">A</span>${esc(l.label)} ↗</a>`).join("")}
                </div>
            </article>`).join("");
    }

    /* ---------- 기관 디렉터리 ---------- */
    let orgField = "all";

    function initOrgs() {
        const chips = [{ id: "all", label: "전체" }, ...REG_DATA.orgFields];
        $("#org-field-chips").innerHTML = chips.map((c) =>
            `<button type="button" class="chip" data-field="${c.id}" aria-pressed="${c.id === "all"}">${esc(c.label)}</button>`
        ).join("");
        $("#org-field-chips").addEventListener("click", (e) => {
            const btn = e.target.closest(".chip");
            if (!btn) return;
            orgField = btn.dataset.field;
            document.querySelectorAll("#org-field-chips .chip").forEach((b) =>
                b.setAttribute("aria-pressed", String(b === btn)));
            renderOrgs();
        });
        renderOrgs();

        $("#db-links").innerHTML = REG_DATA.officialDbs.map((d) => `
            <a class="db-card" href="${esc(d.url)}" target="_blank" rel="noopener">
                <strong><span class="src-grade">A</span>${esc(d.name)} ↗</strong>
                <span>${esc(d.desc)}</span>
            </a>`).join("");
    }

    function renderOrgs() {
        const fieldLabel = (id) => (REG_DATA.orgFields.find((f) => f.id === id) || {}).label || id;
        const orgs = REG_DATA.orgs.filter((o) => orgField === "all" || o.fields.includes(orgField));
        $("#org-cards").innerHTML = orgs.map((o) => `
            <article class="card">
                <div class="card-top">
                    <h3><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)} ↗</a></h3>
                    ${o.fields.map((f) => `<span class="market-badge">${esc(fieldLabel(f))}</span>`).join("")}
                </div>
                <p class="card-summary">${esc(o.desc)}</p>
                <div class="org-quals">${o.quals.map((q) => `<span class="qual-tag">${esc(q)}</span>`).join("")}</div>
                <div class="org-meta"><span>${esc(o.country)}</span><span>${esc(o.location)}</span></div>
                <p class="org-scope-note">⚠ 특정 시험표준 수행 가능 여부는 공식 DB(KOLAS 등)의 인정 Scope에서 확인 후 「확인」으로 기록하세요.</p>
            </article>`).join("");
    }

    /* ---------- 조사 매핑표 ---------- */
    function loadMappings() {
        try { return JSON.parse(localStorage.getItem(LS_MAPPINGS)) || []; }
        catch { return []; }
    }
    function saveMappings(rows) {
        localStorage.setItem(LS_MAPPINGS, JSON.stringify(rows));
    }

    const VERDICTS = {
        confirmed: "확인",
        partial: "부분확인",
        unverified: "미확인",
    };

    function renderMappings() {
        const rows = loadMappings();
        // 판단 우선순위(확인 > 부분확인 > 미확인) 순 정렬
        const order = { confirmed: 0, partial: 1, unverified: 2 };
        rows.sort((a, b) => (order[a.verdict] ?? 3) - (order[b.verdict] ?? 3) || a.reg.localeCompare(b.reg, "ko"));

        $("#map-stat-total").textContent = rows.length;
        $("#map-stat-confirmed").textContent = rows.filter((r) => r.verdict === "confirmed").length;
        $("#map-stat-partial").textContent = rows.filter((r) => r.verdict === "partial").length;
        $("#map-stat-unverified").textContent = rows.filter((r) => r.verdict === "unverified").length;

        const hasRows = rows.length > 0;
        $("#mapping-table").classList.toggle("hidden", !hasRows);
        $("#mapping-empty").classList.toggle("hidden", hasRows);

        $("#mapping-body").innerHTML = rows.map((r) => `
            <tr data-id="${r.id}">
                <td>${esc(r.reg)}</td>
                <td>${esc(r.req)}</td>
                <td>${esc(r.test)}</td>
                <td>${esc(r.std)}</td>
                <td>${esc(r.org)}</td>
                <td>
                    <span class="verdict verdict-${r.verdict}">${VERDICTS[r.verdict] || r.verdict}</span><br>
                    <select class="row-verdict" aria-label="판단 변경">
                        ${Object.entries(VERDICTS).map(([k, v]) =>
                            `<option value="${k}" ${k === r.verdict ? "selected" : ""}>${v}</option>`).join("")}
                    </select>
                </td>
                <td>${esc(r.basis)}</td>
                <td><button type="button" class="row-del" aria-label="삭제">✕</button></td>
            </tr>`).join("");
    }

    function initMappings() {
        $("#mapping-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const rows = loadMappings();
            rows.push({
                id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
                reg: $("#m-reg").value.trim(),
                req: $("#m-req").value.trim(),
                test: $("#m-test").value.trim(),
                std: $("#m-std").value.trim(),
                org: $("#m-org").value.trim(),
                verdict: $("#m-verdict").value,
                basis: $("#m-basis").value.trim(),
            });
            saveMappings(rows);
            e.target.reset();
            renderMappings();
        });

        $("#mapping-body").addEventListener("click", (e) => {
            const del = e.target.closest(".row-del");
            if (!del) return;
            const id = del.closest("tr").dataset.id;
            saveMappings(loadMappings().filter((r) => r.id !== id));
            renderMappings();
        });

        $("#mapping-body").addEventListener("change", (e) => {
            const sel = e.target.closest(".row-verdict");
            if (!sel) return;
            const id = sel.closest("tr").dataset.id;
            const rows = loadMappings();
            const row = rows.find((r) => r.id === id);
            if (row) { row.verdict = sel.value; saveMappings(rows); renderMappings(); }
        });

        $("#clear-mappings").addEventListener("click", () => {
            if (loadMappings().length === 0) return;
            if (confirm("매핑표 전체 항목을 삭제할까요? 되돌릴 수 없습니다.")) {
                saveMappings([]);
                renderMappings();
            }
        });

        $("#export-csv").addEventListener("click", () => {
            const rows = loadMappings();
            if (rows.length === 0) { alert("내보낼 항목이 없습니다."); return; }
            const head = ["규제", "규제 요구사항", "시험·검사", "시험표준", "기관", "Scope 확인", "근거"];
            const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
            const csv = "﻿" + [head, ...rows.map((r) =>
                [r.reg, r.req, r.test, r.std, r.org, VERDICTS[r.verdict] || r.verdict, r.basis]
            )].map((line) => line.map(cell).join(",")).join("\r\n");
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
            a.download = `reg-lab-mapping-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
        });

        renderMappings();
    }

    /* ---------- 초기화 ---------- */
    $("#footer-updated").textContent = REG_DATA.updated;
    initForm();
    initLibrary();
    initOrgs();
    initMappings();
})();

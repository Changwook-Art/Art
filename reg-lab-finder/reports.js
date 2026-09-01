// reg-lab-finder — 조사 리포트 데이터
// Claude Code에서 /reg-lab-finder 조사를 수행한 뒤, 결과를 이 배열의 맨 앞에 추가하고 커밋한다.
// verdict: "confirmed"(확인) | "partial"(부분확인) | "unverified"(미확인)
// factLevel: "FACT" | "INTERPRETATION" | "ASSUMPTION" | "UNVERIFIED"

const REG_REPORTS = [
    {
        id: "galaxy-s22-eu-20260810",
        title: "삼성 갤럭시 S22 — EU",
        date: "2026-08-10",
        product: {
            name: "삼성 갤럭시 S22",
            desc: "스마트폰 (전기전자, 배터리 포함, 무선기능 포함)",
            markets: ["EU"],
        },
        summary: "스마트폰은 무선기기이므로 RED가 LVD·EMC를 흡수하여 단일 적용되며, RoHS·REACH·배터리규정 외에 에코디자인·에너지라벨(2025-06-20~)과 WEEE가 추가 적용된다. 사이버보안(EN 18031)은 제한사항 저촉 시 Notified Body가 필수다.",
        note: "갤럭시 S22는 2022년 EU 출시 시 삼성전자가 CE 적합성평가를 완료한 제품. 본 조사는 '지금(2026-08) 신규 출시한다면' 기준의 분석임.",
        corrections: [
            "대시보드 규칙 매칭 정정 (FACT): 무선기기에는 LVD(2014/35/EU)·EMC 지침(2014/30/EU)이 별도 적용되지 않음 — RED 제3.1조(a)(b)가 전기안전·EMC 요구를 흡수.",
            "누락 규제 식별: 에코디자인 (EU) 2023/1670, 에너지라벨 (EU) 2023/1669 (모두 2025-06-20부터), WEEE 2012/19/EU.",
        ],
        requirements: [
            { reg: "RED 2014/53/EU", req: "Art 3.2 무선성능", need: "시험이 일반적 입증방법", items: "출력·주파수·스퓨리어스", stds: "EN 301 908(셀룰러), EN 300 328(BT/2.4G), EN 301 893(5G WiFi), EN 300 330(NFC)", qual: "ISO/IEC 17025 (해당 EN Scope)", factLevel: "FACT" },
            { reg: "RED 2014/53/EU", req: "Art 3.1(b) EMC", need: "시험이 일반적 입증방법", items: "방출·내성", stds: "EN 301 489-1/-17/-52", qual: "ISO/IEC 17025", factLevel: "FACT" },
            { reg: "RED 2014/53/EU", req: "Art 3.1(a) 안전·SAR", need: "시험이 일반적 입증방법", items: "전기안전, 인체 전자파흡수율", stds: "EN IEC 62368-1, EN 50360/EN 62209 시리즈", qual: "ISO/IEC 17025 (SAR 별도 설비·Scope)", factLevel: "FACT" },
            { reg: "RED 2014/53/EU", req: "Art 3.3(a) USB-C 공통충전기 (2024-12-28~)", need: "문서+시험, 자기평가 가능", items: "USB-C 리셉터클·충전 프로토콜", stds: "지침 (EU) 2022/2380", qual: "제조자 자기평가", factLevel: "FACT" },
            { reg: "RED 2014/53/EU", req: "Art 3.3(d)(e)(f) 사이버보안 (2025-08-01~)", need: "조건부 제3자 — 정합표준 제한사항 저촉 시 NB 필수", items: "네트워크 보호·개인정보·사기방지", stds: "EN 18031-1/-2/-3 (CID (EU) 2025/138, 제한사항 있음)", qual: "제한 저촉 시 EU Notified Body — 스마트폰은 저촉 가능성 높음", factLevel: "INTERPRETATION" },
            { reg: "RoHS 2011/65/EU", req: "유해물질 10종 제한", need: "시험이 일반적 입증방법", items: "Pb·Cd·Hg 등 10종 분석", stds: "IEC 62321 시리즈, EN IEC 63000(기술문서)", qual: "ISO/IEC 17025 (IEC 62321 Scope)", factLevel: "FACT" },
            { reg: "REACH 1907/2006", req: "SVHC 정보전달·Annex XVII", need: "공급망 자료로 대응 가능", items: "필요 시 물질별 분석", stds: "물질별 상이", qual: "ISO/IEC 17025 (물질별 Scope)", factLevel: "FACT" },
            { reg: "배터리규정 (EU) 2023/1542", req: "배터리 CE(2024-08-18~), 라벨·QR(2026-08-18~), 탈착·교체 용이성(2027-02-18~)", need: "조건부", items: "전기화학 성능·내구성, 안전, 설계 검증", stds: "EN IEC 61960, EN IEC 62133-2 등 (이행법령 확인 필요)", qual: "부속서 VIII 모듈에 따름 · 탄소발자국은 휴대용 비대상", factLevel: "FACT" },
            { reg: "에코디자인 (EU) 2023/1670", req: "내낙하·방진방수, 배터리 800사이클 후 80%, 수리성 (2025-06-20~)", need: "시험 필요 (자기평가 + 시장감시 대응)", items: "낙하·IP·배터리 사이클·분해성", stds: "규정 부속서 측정·계산방법", qual: "제조자 자기평가", factLevel: "FACT" },
            { reg: "에너지라벨 (EU) 2023/1669", req: "에너지라벨 부착·EPREL 등록 (2025-06-20~)", need: "시험 필요", items: "배터리 지속시간, 수리성 등급", stds: "규정 부속서 방법", qual: "제조자 등록", factLevel: "FACT" },
            { reg: "WEEE 2012/19/EU", req: "생산자 등록·마킹·재활용 분담", need: "시험 불필요 (등록·문서)", items: "—", stds: "EN 50419(마킹)", qual: "각 회원국 등록기관", factLevel: "FACT" },
        ],
        orgs: [
            { priority: 1, area: "RF·EMC·안전 (RED)", org: "HCT, DT&C, KTL, KTC", qual: "KOLAS(17025), 일부 IECEE CB", verdict: "partial", note: "RED 시험서비스는 공식 확인, 개별 EN 표준의 KOLAS Scope 미확인" },
            { priority: 1, area: "RoHS·REACH 화학분석", org: "KTR, KCL, SGS Korea, Intertek Korea", qual: "KOLAS(17025)", verdict: "partial", note: "IEC 62321 파트별·연도판 Scope 미확인" },
            { priority: 2, area: "배터리 성능·안전", org: "KTL, UL Korea, TÜV 계열 한국법인", qual: "KOLAS/각국 17025, CB", verdict: "partial", note: "" },
            { priority: 2, area: "사이버보안 (EN 18031)", org: "TÜV Rheinland/SÜD, SGS, UL, DEKRA", qual: "EU Notified Body (본사·EU법인)", verdict: "unverified", note: "국내 시험소 수행 가능 여부 개별 확인 필요, 한국 소재 RED NB 확인되지 않음" },
            { priority: 3, area: "SAR, 에코디자인 내구성(낙하·IP·사이클)", org: "미특정", qual: "—", verdict: "unverified", note: "국내 수행기관 추가 조사 필요" },
        ],
        mapping: [
            { reg: "RED", req: "무선·EMC·안전", test: "RF/EMC/안전시험", std: "EN 301 908·300 328·301 489·62368-1", org: "HCT·DT&C·KTL·KTC", verdict: "partial", basis: "기관 공식 서비스 확인, KOLAS Scope 미확인 (2026-08-10)" },
            { reg: "RED", req: "SAR", test: "인체 전자파", std: "EN 50360·62209", org: "미특정", verdict: "unverified", basis: "국내 수행기관 미확인 (2026-08-10)" },
            { reg: "RED 3.3(d–f)", req: "사이버보안", test: "EN 18031 평가(+NB)", std: "EN 18031-1/-2/-3", org: "TÜV 등 + EU NB", verdict: "unverified", basis: "NANDO에서 RED NB 검색 필요 (2026-08-10)" },
            { reg: "RoHS", req: "유해물질", test: "10종 분석", std: "IEC 62321", org: "KTR·KCL·SGS", verdict: "partial", basis: "기관 공식 서비스 확인, Scope 미확인 (2026-08-10)" },
            { reg: "배터리규정", req: "CE·성능·탈착설계", test: "배터리 시험", std: "EN IEC 61960·62133-2", org: "KTL·UL·TÜV", verdict: "partial", basis: "이행법령별 적용 표준 확정 필요 (2026-08-10)" },
            { reg: "에코디자인", req: "내구성·수리성", test: "낙하·IP·800사이클", std: "(EU) 2023/1670 부속서", org: "미특정", verdict: "unverified", basis: "시험기관 추가 조사 필요 (2026-08-10)" },
        ],
        conclusion: {
            ready: [],
            contact: ["HCT·DT&C·KTL·KTC (RF/EMC/안전)", "KTR·KCL·SGS (화학분석)", "KTL·UL·TÜV (배터리)"],
            research: ["SAR 국내 수행기관", "EN 18031 사이버보안 국내 시험 가능 기관 + RED NB 선정", "에코디자인 내구성(낙하·IP·사이클) 시험기관", "배터리규정 이행법령별 적용 표준 확정"],
        },
        questions: [
            "해당 EN 표준 연도판으로 KOLAS 공인성적서 발급 가능한지 + 인정범위 부속서 사본 요청",
            "EU NB 협력 여부 (사이버보안 포함 원스톱 가능한지)",
            "시료 수량·납기",
            "성적서의 EU 시장 수용성 (ILAC MRA)",
        ],
        sources: [
            { label: "EN 18031 정합 고시·제한사항 — CID (EU) 2025/138 (EUR-Lex)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32025D0138", grade: "A" },
            { label: "에코디자인 (EU) 2023/1670 (EUR-Lex)", url: "https://eur-lex.europa.eu/eli/reg/2023/1670/oj/eng", grade: "A" },
            { label: "EU Commission — 배터리규정", url: "https://environment.ec.europa.eu/topics/waste-and-recycling/batteries_en", grade: "A" },
            { label: "Eurofins — RED 사이버보안 시행 안내", url: "https://metlabs.com/wireless-rf/red-cybersecurity-requirements-take-effect-august-1-2025-what-manufacturers-need-to-know/", grade: "B" },
            { label: "Intertek — 배터리 탈착 2027 요건", url: "https://www.intertek.com/blog/2025/06-27-2027-reqs-for-removability-and-replaceability-of-batteries-in-electrical-products/", grade: "B" },
            { label: "Cetecom — RED 해설 (LVD·EMC 흡수)", url: "https://cetecomadvanced.com/en/news/red/", grade: "B" },
        ],
    },
];

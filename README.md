# 🌿 hi eco

EU **Have Your Say** 의견수렴(공공 협의) 최신 동향을 한 페이지에서 모아보는 대시보드입니다.
메일 알림을 한 건씩 열어보는 대신, 관심 주제의 진행 중인 의견수렴과 마감 일정을 한눈에 확인할 수 있습니다.

- **페이지**: [`hi-eco/index.html`](hi-eco/index.html) — GitHub Pages 배포 시 `https://changwook-art.github.io/Art/hi-eco/`
- **데이터**: `hi-eco/data/initiatives.json` — GitHub Actions가 **매일 05:00 UTC(한국시간 14:00)** 에 EU 집행위 공개 API에서 자동 수집·커밋
- **주제 설정**: [`hi-eco/topics.json`](hi-eco/topics.json)에서 `active: true/false`로 추적 주제 변경 (기본: 환경, 기후변화 대응, 에너지)
- **수동 갱신**: GitHub → Actions → *Update EU consultations data* → **Run workflow**

기능: 진행 중/마감 임박(D-7) 상태 배지와 D-day, 주제·상태·키워드 필터, 마감 임박순/최신 공개순 정렬, 각 항목에서 Have Your Say 의견 제출 페이지로 바로 이동, 라이트/다크 모드.

> 참고: 예약 실행(cron)은 기본 브랜치(main)에 병합된 뒤부터 동작합니다.

---

# 🔬 규제 시험·검사기관 탐색 (reg-lab-finder)

특정 제품에 적용되는 규제를 분석하고, 규제 → 요구사항 → 시험·검사 항목 → 시험표준 → 기관 자격 → 인정 Scope 순으로 검증하여 실제 수행 가능한 시험·검사·인증기관을 근거와 함께 찾는 도구 세트입니다.

**① 대시보드** — [`reg-lab-finder/index.html`](reg-lab-finder/index.html) · GitHub Pages 배포 시 `https://changwook-art.github.io/Art/reg-lab-finder/`

- **제품 분석**: 제품 정보·대상 시장·특성(전기전자/배터리/무선)을 입력하면 적용 가능성 있는 규제를 규칙 매칭으로 표시하고, Claude 심층 조사용 프롬프트를 자동 생성
- **규제·시험 라이브러리**: EU(RoHS·REACH·LVD·EMC·RED·배터리규정), KC(전기안전·전파법), US FCC의 요구사항 → 시험항목 → 시험표준 → 기관 자격 매핑 (법령 원문 A등급 출처 링크 포함)
- **기관 디렉터리**: 국내(KTL·KTC·KTR·KCL·HCT·DT&C) 및 글로벌(SGS·TÜV·Intertek·UL 등) 시험·인증기관과 KOLAS·NANDO·IECEE 등 공식 Scope 검증 DB 바로가기
- **조사 매핑표**: 규제→시험→기관 조사 결과를 확인/부분확인/미확인 판단과 함께 기록·관리 (브라우저 저장, CSV 내보내기)
- **조사 리포트**: Claude Code에서 조사를 수행하면 결과가 `reg-lab-finder/reports.js`에 커밋되어 리포트로 표시 — 리포트의 매핑을 조사 매핑표로 가져오기 지원

**② Claude Code 스킬** — [`.claude/skills/reg-lab-finder/SKILL.md`](.claude/skills/reg-lab-finder/SKILL.md)

- 이 저장소에서 Claude Code 세션을 열고 `/reg-lab-finder`를 입력하거나, 제품 정보와 함께 시험·인증기관 탐색을 요청하면 자동으로 적용됩니다.
- ISO/IEC 17025·KOLAS·Notified Body 등 기관 자격과 공식 인정 Scope를 근거로 검증하며, 모든 판단을 확인/부분확인/미확인 및 FACT/INTERPRETATION/ASSUMPTION/UNVERIFIED로 구분해 제시합니다.
- 대시보드에서 생성한 프롬프트를 붙여넣으면 인정 Scope 검증까지 포함한 전체 조사가 수행되고, 결과를 대시보드 매핑표에 기록해 관리할 수 있습니다.

---

# 🌱 ESG Stock Tracker

A web application to track Environmental, Social, and Governance (ESG) performance of US stocks.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Status](https://img.shields.io/badge/status-MVP-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## 📖 Overview

ESG Stock Tracker allows users to search for US stock tickers and view their ESG (Environmental, Social, and Governance) performance ratings and activities. This MVP version includes sample data for 10 major US companies.

### Available Stocks
- **AAPL** - Apple Inc.
- **MSFT** - Microsoft Corporation
- **GOOGL** - Alphabet Inc. (Google)
- **TSLA** - Tesla, Inc.
- **AMZN** - Amazon.com, Inc.
- **META** - Meta Platforms, Inc.
- **NVDA** - NVIDIA Corporation
- **JPM** - JPMorgan Chase & Co.
- **JNJ** - Johnson & Johnson
- **PG** - Procter & Gamble Co.

## ✨ Features

### Current Features (MVP v1.0)
- 🔍 Stock ticker search functionality
- 📊 Overall ESG score display with rating system
- 🌍 Environmental score and activities breakdown
- 👥 Social score and activities breakdown
- ⚖️ Governance score and activities breakdown
- 📱 Fully responsive design (mobile, tablet, desktop)
- 🎨 Modern, professional UI with gradient design
- ⚡ Fast, client-side rendering (no backend required)

### Coming Soon (Roadmap)
- 📈 ESG score trend charts
- 🔄 Real-time data via API integration
- 🏢 Expanded company database (500+ stocks)
- 🔔 Score change alerts
- 📊 Industry comparison features
- 📰 Related ESG news integration
- 💾 Save favorite stocks
- 📱 Progressive Web App (PWA) support

## 🚀 Getting Started

### Option 1: View Online (Easiest)
Once deployed to GitHub Pages, the site will be available at:
```
https://YOUR-USERNAME.github.io/ESG-Stock-Tracker/
```

### Option 2: Run Locally
1. Clone or download this repository
2. Open `index.html` in any modern web browser
3. No installation or build process required!

```bash
# If you have Python installed, you can serve it locally:
python -m http.server 8000

# Or with Node.js:
npx serve
```

## 📦 Project Structure

```
ESG-Stock-Tracker/
├── index.html          # Main HTML file
├── style.css          # Styling and responsive design
├── script.js          # Search logic and UI interactions
├── data.js            # ESG sample data (will be replaced with API)
└── README.md          # This file
```

## 🌐 Deploying to GitHub Pages

### Step 1: Create GitHub Repository
1. Go to GitHub.com
2. Click "New Repository"
3. Name it: `ESG-Stock-Tracker`
4. Make it Public
5. Don't add README (we already have one)

### Step 2: Upload Files
1. Click "uploading an existing file"
2. Drag and drop all 5 files:
   - `index.html`
   - `style.css`
   - `script.js`
   - `data.js`
   - `README.md`
3. Commit the files

### Step 3: Enable GitHub Pages
1. Go to repository Settings
2. Click "Pages" in the left sidebar
3. Under "Source", select "main" branch
4. Click "Save"
5. Wait 1-2 minutes
6. Your site will be live at: `https://YOUR-USERNAME.github.io/ESG-Stock-Tracker/`

## 💻 How to Use

1. Open the website
2. Enter a stock ticker (e.g., AAPL, TSLA, MSFT)
3. Click "Search" or press Enter
4. View the ESG scores and detailed activities
5. Try another ticker to compare

## 🔧 Technical Details

### Technologies Used
- **HTML5** - Structure
- **CSS3** - Styling with gradients, animations, and flexbox/grid
- **Vanilla JavaScript** - No frameworks needed for MVP
- **Responsive Design** - Mobile-first approach

### Browser Compatibility
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers

## 📊 Data Source

**Current Version (MVP):**
- Sample data for educational purposes
- Manually curated ESG information
- Updated: November 2024

**Future Versions:**
Data will be sourced from:
- Financial APIs (Alpha Vantage, Yahoo Finance)
- ESG Rating Providers (MSCI, Sustainalytics, Refinitiv)
- Real-time updates

## 🛣️ Roadmap

### Phase 1: MVP (Current) ✅
- [x] Basic search functionality
- [x] 10 sample companies
- [x] Responsive design
- [x] ESG breakdown display

### Phase 2: Data Expansion (1-2 months)
- [ ] Add 50+ more companies
- [ ] Industry categorization
- [ ] Search autocomplete
- [ ] More detailed ESG metrics

### Phase 3: API Integration (3-6 months)
- [ ] Connect to financial data APIs
- [ ] Real-time ESG data
- [ ] Automatic updates
- [ ] Historical data tracking

### Phase 4: Advanced Features (6+ months)
- [ ] User accounts
- [ ] Watchlists
- [ ] ESG score alerts
- [ ] Comparison tools
- [ ] News integration
- [ ] PDF report generation

## 🤝 Contributing

This is currently a personal project, but suggestions are welcome!

### Future Enhancement Ideas:
- Add more ESG metrics (carbon footprint, water usage, etc.)
- Implement data visualization (charts, graphs)
- Add company comparison feature
- Create API endpoints for developers
- Build mobile apps (iOS/Android)

## 📄 License

MIT License - Feel free to use this project for learning or personal use.

## 📞 Contact

Created by Changwook-Art

- GitHub: [@Changwook-Art](https://github.com/Changwook-Art)
- Project: [ESG Stock Tracker](https://github.com/Changwook-Art/Art)

## 🙏 Acknowledgments

- ESG data inspired by public sustainability reports
- Design inspired by modern financial platforms
- Built with educational purposes in mind

## ⚠️ Disclaimer

This tool is for educational purposes only. ESG scores and information are sample data and should not be used for investment decisions. Always consult official company reports and professional financial advisors for investment guidance.

---

**Last Updated:** November 2024  
**Version:** 1.0.0 (MVP)  
**Status:** Active Development 🚀

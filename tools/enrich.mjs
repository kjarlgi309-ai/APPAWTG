// ============================================================
// APPAWTG — TourAPI 운영정보 자동 수집기 (enrich.mjs)
// 좌표로 장소를 TourAPI에 매칭(contentid) → 운영시간·휴무·주차·유모차 수집
// 결과: info_auto.js  (window.INFO_AUTO = { "장소명": {운영시간,휴무,주차,유아차}, ... })
//
// ▶ 사용법
//   1) data.go.kr 에서 "한국관광공사 국문 관광정보 서비스" 인증키 발급
//   2) 환경변수로 키 전달해서 실행:
//        TOUR_API_KEY="발급받은_디코딩키" node enrich.mjs --probe 국립과천과학관   ← 먼저 1곳 점검
//        TOUR_API_KEY="발급받은_디코딩키" node enrich.mjs --limit 50              ← 일부만 수집(테스트)
//        TOUR_API_KEY="발급받은_디코딩키" node enrich.mjs                          ← 전체 수집
// ============================================================
import fs from "fs";
import vm from "vm";

const KEY = process.env.TOUR_API_KEY;
if (!KEY) { console.error("환경변수 TOUR_API_KEY 가 필요해요. (data.go.kr 인증 디코딩키)"); process.exit(1); }

// TourAPI 베이스 — 2026 기준 KorService2. 만약 NO_OPENAPI_SERVICE_ERROR 가 나면 KorService1 로 바꿔보세요.
const BASE = "https://apis.data.go.kr/B551011/KorService2";
const COMMON = `serviceKey=${encodeURIComponent(KEY)}&MobileOS=ETC&MobileApp=APPAWTG&_type=json`;

const args = process.argv.slice(2);
const probeIdx = args.indexOf("--probe");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

// ---------- 데이터 로드 (generate.mjs 와 동일) ----------
function loadData() {
  const ex = fs.readFileSync("places_extra.js", "utf8");
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(ex + ";globalThis.__E=(typeof EXTRA!=='undefined')?EXTRA:[];globalThis.__B=(typeof BASE_COORDS!=='undefined')?BASE_COORDS:{};", ctx);
  const EXTRA = ctx.__E, BC = ctx.__B;
  const idx = fs.readFileSync("index.html", "utf8");
  const m = idx.match(/const PLACES\s*=\s*(\[[\s\S]*?\n\]);/);
  let P = []; if (m) { const c2 = {}; vm.createContext(c2); vm.runInContext("globalThis.__P=" + m[1], c2); P = c2.__P; }
  P.forEach(p => { const c = BC[p.n]; if (c) { p.x = c[0]; p.y = c[1]; } });
  return [...P, ...EXTRA];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const stripHtml = s => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const shortName = n => n.split("+")[0].trim();
const norm = s => String(s || "").toLowerCase().replace(/[\s()·\-_,]/g, "");

async function api(op, params) {
  const url = `${BASE}/${op}?${COMMON}&${params}`;
  const res = await fetch(url);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch (e) { throw new Error("JSON 파싱 실패 — 응답 일부: " + txt.slice(0, 200)); }
}
function items(json) {
  const it = json?.response?.body?.items?.item;
  return !it ? [] : Array.isArray(it) ? it : [it];
}

// 좌표로 후보 검색 → 이름 매칭 → {contentid, contenttypeid}
async function matchContent(p) {
  if (!p.x || !p.y) return null;
  const j = await api("locationBasedList2", `mapX=${p.x}&mapY=${p.y}&radius=2000&arrange=E&numOfRows=30`);
  const cands = items(j);
  const target = norm(shortName(p.n));
  let best = null;
  for (const c of cands) {
    const t = norm(c.title);
    if (t === target || t.includes(target) || target.includes(t)) { best = c; break; }
  }
  return best ? { contentid: best.contentid, contenttypeid: best.contenttypeid, title: best.title } : null;
}

// 소개정보 → info
async function intro(contentid, contenttypeid) {
  const j = await api("detailIntro2", `contentId=${contentid}&contentTypeId=${contenttypeid}`);
  const d = items(j)[0] || {};
  const info = {};
  // contentTypeId 별로 필드명이 조금 다름 — 관광지(12) 기준 + 흔한 대체 키 함께 시도
  const usetime = d.usetime || d.usetimeculture || d.opentime || d.usetimeleports;
  const restdate = d.restdate || d.restdateculture || d.restdateleports;
  const parking = d.parking || d.parkingculture || d.parkingleports;
  const baby = d.chkbabycarriage || d.chkbabycarriageculture || d.chkbabycarriageleports;
  if (usetime) info.운영시간 = stripHtml(usetime);
  if (restdate) info.휴무 = stripHtml(restdate);
  if (parking) info.주차 = stripHtml(parking);
  if (baby) info.유아차 = stripHtml(baby);
  return info;
}

// ---------- 실행 ----------
const ALL = loadData();

if (probeIdx >= 0) {
  const name = args[probeIdx + 1];
  const p = ALL.find(x => shortName(x.n) === name || x.n === name);
  if (!p) { console.error("그 이름의 장소를 못 찾음:", name); process.exit(1); }
  console.log("PROBE:", p.n, "(", p.x, p.y, ")");
  const j = await api("locationBasedList2", `mapX=${p.x}&mapY=${p.y}&radius=2000&arrange=E&numOfRows=10`);
  console.log("\n[locationBasedList 후보 제목들]");
  items(j).forEach(c => console.log(" -", c.title, "| id:", c.contentid, "| type:", c.contenttypeid));
  const mc = await matchContent(p);
  console.log("\n[매칭 결과]", mc);
  if (mc) {
    const dj = await api("detailIntro2", `contentId=${mc.contentid}&contentTypeId=${mc.contenttypeid}`);
    console.log("\n[detailIntro 원본 필드]");
    console.log(JSON.stringify(items(dj)[0] || {}, null, 2));
    console.log("\n[추출된 info]", await intro(mc.contentid, mc.contenttypeid));
  }
  process.exit(0);
}

// 전체/일부 수집
const out = {};
let done = 0, matched = 0;
for (const p of ALL) {
  if (done >= LIMIT) break;
  done++;
  try {
    const mc = await matchContent(p);
    if (mc) {
      const info = await intro(mc.contentid, mc.contenttypeid);
      if (Object.keys(info).length) { out[p.n] = info; matched++; }
    }
  } catch (e) { console.error("  실패:", p.n, e.message); }
  if (done % 25 === 0) console.error(`...${done}/${Math.min(ALL.length, LIMIT)} 처리, ${matched}곳 매칭`);
  await sleep(120); // API 예의상 호출 간격
}
fs.writeFileSync("info_auto.js", "window.INFO_AUTO=" + JSON.stringify(out) + ";");
console.log(`완료: ${done}곳 시도 → ${matched}곳에서 정보 수집 → info_auto.js 저장`);

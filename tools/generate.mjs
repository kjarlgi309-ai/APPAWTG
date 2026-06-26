// APPAWTG 정적 SEO 페이지 생성기
// 입력: ../index.html(또는 uploads) 의 PLACES + places_extra.js 의 EXTRA/BASE_COORDS
// 출력: site/place/<slug>/index.html, site/list/<slug>/index.html, site/sitemap.xml, site/robots.txt
import fs from "fs";
import path from "path";
import vm from "vm";

const SITE = "https://appawtg.com";
const OUT = "_site";
const TODAY = new Date().toISOString().slice(0,10);

// ---------- 데이터 로드 ----------
function loadData(){
  // EXTRA + BASE_COORDS
  const ex = fs.readFileSync("places_extra.js","utf8");
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(ex + "\n;globalThis.__EXTRA=(typeof EXTRA!=='undefined')?EXTRA:[];globalThis.__BC=(typeof BASE_COORDS!=='undefined')?BASE_COORDS:{};", ctx);
  const EXTRA = ctx.__EXTRA || [];
  const BC = ctx.__BC || {};
  // PLACES (index.html 안의 배열 리터럴 추출)
  const idx = fs.readFileSync("index.html","utf8");
  const m = idx.match(/const PLACES\s*=\s*(\[[\s\S]*?\n\]);/);
  let PLACES = [];
  if(m){ const c2={}; vm.createContext(c2); vm.runInContext("globalThis.__P="+m[1], c2); PLACES=c2.__P; }
  // 좌표 적용
  PLACES.forEach(p=>{ const c=BC[p.n]; if(c){p.x=c[0];p.y=c[1];} });
  return [...PLACES, ...EXTRA];
}

// ---------- 한글 로마자(개정) 슬러그 ----------
const CHO=["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
const JUNG=["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
const JONG=["","k","kk","ks","n","nj","nh","t","l","lg","lm","lb","ls","lt","lp","lh","m","b","bs","s","ss","ng","j","ch","k","t","p","h"];
function romanizeChar(ch){
  const code=ch.charCodeAt(0);
  if(code>=0xAC00 && code<=0xD7A3){
    const i=code-0xAC00;
    return CHO[Math.floor(i/588)]+JUNG[Math.floor((i%588)/28)]+JONG[i%28];
  }
  if(/[a-zA-Z0-9]/.test(ch)) return ch.toLowerCase();
  return "-";
}
function slugify(name){
  let s=[...name].map(romanizeChar).join("");
  s=s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  return s||"place";
}
function shortName(n){ return n.split("+")[0].trim(); }
function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

// ---------- 공통 레이아웃 ----------
const HEAD_CSS=`
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#faf8f5;color:#2b2620;line-height:1.6}
.wrap{max-width:760px;margin:0 auto;padding:0 18px 70px}
header{padding:22px 0 6px}
.logo{font-size:14px;font-weight:800;color:#ff6b35;text-decoration:none;letter-spacing:-.3px}
.crumb{font-size:12.5px;color:#8a8178;margin-top:10px}
.crumb a{color:#8a8178;text-decoration:none}
h1{font-size:clamp(22px,5vw,30px);font-weight:800;letter-spacing:-.6px;margin:14px 0 6px}
.loc{color:#ff6b35;font-weight:700;font-size:14px}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}
.badge{font-size:12px;padding:4px 10px;border-radius:99px;background:#f3eee7;color:#6b6359;font-weight:700}
.badge.free{background:#e8f5e9;color:#2e7d32}
.desc{font-size:15px;color:#4a443c;margin:14px 0 18px}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 18px}
.tag{font-size:12px;padding:4px 9px;border-radius:6px;background:#f3eee7;color:#7a7268;font-weight:600;text-decoration:none}
.maps{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 24px}
.maps a{font-size:13px;font-weight:700;text-decoration:none;border:1.5px solid #2b2620;border-radius:8px;padding:8px 12px;color:#2b2620}
.maps a.naver{background:#03c75a;border-color:#03c75a;color:#fff}
.maps a.kakao{background:#fee500;border-color:#f7c600;color:#191919}
.cta{display:block;text-align:center;background:linear-gradient(135deg,#ff6b35,#ff8f5e);color:#fff;font-weight:800;padding:15px;border-radius:14px;text-decoration:none;margin:10px 0}
.sec-t{font-size:15px;font-weight:800;margin:26px 0 10px}
.grid{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:560px){.grid{grid-template-columns:1fr 1fr}}
.card{display:block;background:#fff;border:1px solid #eee7de;border-radius:14px;padding:15px;text-decoration:none;color:inherit;transition:.15s}
.card:hover{box-shadow:0 6px 16px rgba(0,0,0,.06)}
.card .e{font-size:24px}
.card .n{font-size:15px;font-weight:800;margin:6px 0 2px}
.card .l{font-size:12.5px;color:#ff6b35;font-weight:700}
.card .d{font-size:12.5px;color:#6b6359;margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.links{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.links a{font-size:13px;color:#5b3fd1;text-decoration:none;background:#f5f3ff;border:1px solid #e7e2fb;border-radius:99px;padding:5px 11px}
footer{margin-top:36px;padding-top:18px;border-top:1px solid #eee7de;font-size:12px;color:#8a8178}
footer a{color:#8a8178}
.pinfo{display:flex;flex-direction:column;gap:7px;background:#fff;border:1px solid #eee7de;border-radius:14px;padding:14px 16px;margin:8px 0 4px}
.pinfo>div{display:flex;gap:12px;font-size:14px}
.pinfo span{color:#8a8178;font-weight:600;flex:0 0 auto;min-width:72px}
.pinfo b{color:#3a352e;font-weight:600;text-align:left;flex:1;word-break:break-word;line-height:1.5}
`;
function page({title,desc,canonical,jsonld,body}){
  return `<!DOCTYPE html><html lang="ko"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canonical}">
<meta property="og:locale" content="ko_KR">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚗</text></svg>">
${jsonld?`<script type="application/ld+json">${JSON.stringify(jsonld)}</scr`+`ipt>`:""}
<style>${HEAD_CSS}</style></head><body><div class="wrap">${body}
<footer><p>입장료·운영시간은 변동될 수 있어요. 방문 전 공식 정보를 확인하세요.</p>
<p style="margin-top:6px">© 2026 <a href="${SITE}/">APPAWTG</a> · 문의 kjarlgi309@gmail.com · <a href="${SITE}/privacy/">개인정보처리방침</a></p></footer>
</div></body></html>`;
}

function costBadge(c){ return c==='무료'?'<span class="badge free">💸 무료</span>':c==='가성비'?'<span class="badge">💰 1만원↓</span>':'<span class="badge">💳 플렉스</span>'; }
function placeBadge(p){ return p==='실내'?'<span class="badge">☔ 실내</span>':p==='실외'?'<span class="badge">☀️ 실외</span>':'<span class="badge">⛅ 실내+실외</span>'; }
function naverUrl(n){ return "https://map.naver.com/p/search/"+encodeURIComponent(shortName(n)); }
function kakaoUrl(p){ const n=encodeURIComponent(shortName(p.n)); return p.y?`https://map.kakao.com/link/map/${n},${p.y},${p.x}`:`https://map.kakao.com/link/search/${n}`; }
function googleUrl(p){ return p.y?`https://www.google.com/maps/dir/?api=1&destination=${p.y},${p.x}`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shortName(p.n))}`; }

// ---------- 빌드 ----------
const ALL = loadData();
let INFO_AUTO={}; try{ INFO_AUTO=JSON.parse(fs.readFileSync("info_auto.js","utf8").trim().replace(/^window\.INFO_AUTO\s*=\s*/,"").replace(/;?\s*$/,"")); }catch(e){}
// 슬러그 부여(중복 방지)
const used={};
ALL.forEach(p=>{ let s=slugify(shortName(p.n)); if(used[s]){ used[s]++; s=s+"-"+used[s]; } else used[s]=1; p.slug=s; });

const REGIONS=["수도권","강원","충청","경상","전라","제주"];
// 도시(시·군) 추출 — 앱의 cityOf와 동일 로직
const METRO=["서울","부산","대구","인천","광주","대전","울산","세종"];
function cityOf(p){
  const t=(p.l||"").trim().split(/\s+/);
  if(METRO.includes(t[0])) return t[0];
  let c=t[1]||t[0]||"";
  return c.replace(/(특별자치시|특별자치도|특별시|광역시|시|군|구)$/,"");
}
const urls=[]; // sitemap

function write(rel,html){ const fp=path.join(OUT,rel); fs.mkdirSync(path.dirname(fp),{recursive:true}); fs.writeFileSync(fp,html); }

// 조건 조합 목록 정의
const COMBOS=[];
for(const r of REGIONS){
  COMBOS.push({key:`${r}`, slug:slugify(r), test:p=>p.r===r, title:`${r} 아이랑 가볼만한 곳`, h:`${r}에서 아이랑 가볼만한 곳`});
  COMBOS.push({key:`${r}-실내`, slug:slugify(r)+"-silnae", test:p=>p.r===r&&(p.p==="실내"||p.p==="혼합"), title:`${r} 비 와도 좋은 실내 나들이`, h:`${r} 비 와도 좋은 실내 나들이`});
  COMBOS.push({key:`${r}-실외`, slug:slugify(r)+"-silwoe", test:p=>p.r===r&&(p.p==="실외"||p.p==="혼합"), title:`${r} 실외 나들이`, h:`${r} 아이랑 실외 나들이`});
  COMBOS.push({key:`${r}-유아`, slug:slugify(r)+"-yua", test:p=>p.r===r&&p.a.includes("유아"), title:`${r} 유아랑 가볼만한 곳`, h:`${r} 유아(0~6세)랑 가볼만한 곳`});
  COMBOS.push({key:`${r}-초등`, slug:slugify(r)+"-chodeung", test:p=>p.r===r&&p.a.includes("초등"), title:`${r} 초등학생이랑 갈 곳`, h:`${r} 초등학생이랑 갈 곳`});
  COMBOS.push({key:`${r}-무료`, slug:slugify(r)+"-muryo", test:p=>p.r===r&&p.c==="무료", title:`${r} 무료 나들이`, h:`${r} 무료 나들이`});
}

// 도시 단위 목록 (예: 춘천 / 부산) — "춘천 아이랑 갈만한 곳" 류 검색 대응
{
  const usedSlug=new Set(COMBOS.map(c=>c.slug));
  const cityMap={}; // "region|city" -> count
  ALL.forEach(p=>{ const c=cityOf(p); if(!c) return; const k=p.r+"|"+c; cityMap[k]=(cityMap[k]||0)+1; });
  Object.keys(cityMap).forEach(k=>{
    if(cityMap[k]<3) return; // 빈약한 페이지 방지: 3곳 이상만
    const [r,c]=k.split("|");
    let sl="c-"+slugify(c);
    if(usedSlug.has(sl)) sl=sl+"-"+slugify(r);
    usedSlug.add(sl);
    COMBOS.push({key:`${r}-도시-${c}`, slug:sl, city:true,
      test:p=>p.r===r&&cityOf(p)===c,
      title:`${c} 아이랑 가볼만한 곳`, h:`${c} 아이랑 가볼만한 곳`});
  });
}

// place -> 관련 combo (내부링크)
function relatedCombos(p){
  return COMBOS.filter(c=>c.list && c.list.length>=(c.city?3:4) && c.test(p))
    .sort((a,b)=>(b.city?1:0)-(a.city?1:0)).slice(0,5);
}
// 먼저 combo별 list 계산
COMBOS.forEach(c=>{ c.list=ALL.filter(c.test); });
const liveCombos=COMBOS.filter(c=>c.list.length>=(c.city?3:4));

function cardHtml(p){
  return `<a class="card" href="${SITE}/place/${p.slug}/"><div class="e">${p.e||"📍"}</div>
  <div class="n">${esc(shortName(p.n))}</div><div class="l">📍 ${esc(p.l)}</div>
  <div class="d">${esc(p.d||"")}</div></a>`;
}

// ----- 장소 페이지 -----
ALL.forEach(p=>{
  const nm=shortName(p.n);
  const title=`${nm} — ${p.l} 아이랑 가볼만한 곳 | APPAWTG`;
  const desc=`${p.l} ${nm}. ${(p.d||"").slice(0,90)} 지역·날씨·나이·예산으로 고르는 가족 나들이.`;
  const canonical=`${SITE}/place/${p.slug}/`;
  const jsonld={"@context":"https://schema.org","@type":"TouristAttraction",name:nm,description:p.d||"",
    address:{"@type":"PostalAddress",addressRegion:p.l,addressCountry:"KR"},
    isAccessibleForFree:p.c==="무료"};
  if(p.y&&p.x) jsonld.geo={"@type":"GeoCoordinates",latitude:p.y,longitude:p.x};
  const rel=relatedCombos(p);
  const body=`<header><a class="logo" href="${SITE}/">🚗 아빠, 이번 주말 어디가?</a>
  <div class="crumb"><a href="${SITE}/">홈</a> › ${esc(p.r)} › ${esc(nm)}</div></header>
  <h1>${p.e||"📍"} ${esc(nm)}</h1><div class="loc">📍 ${esc(p.l)}</div>
  <div class="badges">${costBadge(p.c)}${placeBadge(p.p)}${p.a.map(a=>`<span class="badge">${a==='유아'?'👶 유아':'🧒 초등'}</span>`).join("")}</div>
  <p class="desc">${esc(p.d||"")}</p>
  <div class="tags">${(p.t||[]).map(t=>`<span class="tag">#${esc(t)}</span>`).join("")}</div>
  ${(()=>{const info=Object.assign({},INFO_AUTO[p.n]||{},p.info||{});const r=[["🕘","운영시간",info.운영시간],["💵","요금",info.요금],["🅿️","주차",info.주차],["🚼","유아차",info.유아차],["🍼","수유실",info.수유실],["🚻","화장실",info.화장실],["👶","기저귀교환대",info.기저귀교환대]].filter(x=>x[2]);return r.length?`<div class="sec-t">아빠 시점 정보</div><div class="pinfo">${r.map(x=>`<div><span>${x[0]} ${x[1]}</span><b>${esc(x[2])}</b></div>`).join("")}</div>`:"";})()}
  <div class="maps"><a class="naver" href="${naverUrl(p.n)}" target="_blank" rel="noopener">네이버 지도</a>
  <a class="kakao" href="${kakaoUrl(p)}" target="_blank" rel="noopener">카카오 지도</a>
  <a href="${googleUrl(p)}" target="_blank" rel="noopener">구글 지도</a></div>
  <a class="cta" href="${SITE}/">← 첫 화면으로 돌아가기</a>
  ${rel.length?`<div class="sec-t">이런 목록에도 있어요</div><div class="links">${rel.map(c=>`<a href="${SITE}/list/${c.slug}/">${esc(c.title)}</a>`).join("")}</div>`:""}`;
  write(`place/${p.slug}/index.html`, page({title,desc,canonical,jsonld,body}));
  urls.push({loc:canonical,pri:"0.7"});
});

// ----- 조합 목록 페이지 -----
liveCombos.forEach(c=>{
  const n=c.list.length;
  const title=`${c.title} ${n}곳 (아이랑) | APPAWTG`;
  const desc=`${c.h} ${n}곳 모음. 입장료·실내외·나이·예산까지 한눈에. 아빠가 만든 가족 나들이 큐레이션.`;
  const canonical=`${SITE}/list/${c.slug}/`;
  const jsonld={"@context":"https://schema.org","@type":"ItemList",name:title,
    itemListElement:c.list.slice(0,30).map((p,i)=>({"@type":"ListItem",position:i+1,url:`${SITE}/place/${p.slug}/`,name:shortName(p.n)}))};
  const body=`<header><a class="logo" href="${SITE}/">🚗 아빠, 이번 주말 어디가?</a>
  <div class="crumb"><a href="${SITE}/">홈</a> › 목록 › ${esc(c.title)}</div></header>
  <h1>${esc(c.h)} <span style="color:#ff6b35">${n}곳</span></h1>
  <p class="desc">${esc(c.h)}을(를) 모았어요. 카드를 누르면 장소별 상세로 이동해요.</p>
  <div class="grid">${c.list.map(cardHtml).join("")}</div>`;
  write(`list/${c.slug}/index.html`, page({title,desc,canonical,jsonld,body}));
  urls.push({loc:canonical,pri:"0.8"});
});

// ----- 목록 허브 (/list/) -----
{
  const body=`<header><a class="logo" href="${SITE}/">🚗 아빠, 이번 주말 어디가?</a>
  <div class="crumb"><a href="${SITE}/">홈</a> › 목록</div></header>
  <h1>지역·조건별 나들이 목록</h1>
  ${REGIONS.map(r=>{const cs=liveCombos.filter(c=>c.key.startsWith(r)&&!c.city); const cities=liveCombos.filter(c=>c.key.startsWith(r)&&c.city); return `<div class="sec-t">${r}</div><div class="links">${cs.map(c=>`<a href="${SITE}/list/${c.slug}/">${esc(c.title)} (${c.list.length})</a>`).join("")}</div>`+(cities.length?`<div class="links" style="margin-top:6px">${cities.map(c=>`<a href="${SITE}/list/${c.slug}/">🏙️ ${esc(c.title)} (${c.list.length})</a>`).join("")}</div>`:"");}).join("")}`;
  write(`list/index.html`, page({title:`지역·조건별 나들이 목록 | APPAWTG`,desc:`수도권·강원·충청·경상·전라·제주 지역별, 실내/실외·나이·예산 조건별 아이랑 가볼만한 곳 목록.`,canonical:`${SITE}/list/`,jsonld:null,body}));
  urls.push({loc:`${SITE}/list/`,pri:"0.8"});
}

// ----- 개인정보처리방침 (검수/애드센스 대비 최소본) -----
{
  const body=`<header><a class="logo" href="${SITE}/">🚗 아빠, 이번 주말 어디가?</a></header>
  <h1>개인정보처리방침</h1>
  <p class="desc">APPAWTG(appawtg.com, 이하 '서비스')는 회원가입 없이 이용되는 정적 웹사이트입니다. 서비스는 이름·연락처 등 개인을 식별하는 정보를 직접 수집·저장하지 않습니다.</p>
  <div class="sec-t">1. 수집 항목</div><p class="desc">서비스 자체는 개인정보를 수집하지 않습니다. 다만 방문 통계를 위해 Google Analytics가 쿠키 기반의 비식별 이용 정보(접속 기기·페이지·체류시간 등)를 수집할 수 있습니다.</p>
  <div class="sec-t">2. 한줄평(이용자 게시물)</div><p class="desc">이용자가 자발적으로 남긴 한줄평·별점·닉네임은 Google Firebase에 저장됩니다. 닉네임은 선택 사항이며 실명을 적지 않기를 권장합니다. 부적절한 게시물은 신고 또는 운영자 검토로 삭제될 수 있습니다.</p>
  <div class="sec-t">3. 쿠키</div><p class="desc">분석 도구가 쿠키를 사용합니다. 브라우저 설정에서 쿠키를 거부할 수 있으며, 이 경우 일부 기능이 제한될 수 있습니다.</p>
  <div class="sec-t">4. 제3자 도구</div><p class="desc">Google Analytics, Google Firebase, Open-Meteo(날씨), 지도(네이버·카카오·구글) 링크가 사용됩니다. 각 도구는 자체 정책에 따라 데이터를 처리합니다.</p>
  <div class="sec-t">5. 문의</div><p class="desc">개인정보 관련 문의: kjarlgi309@gmail.com</p>
  <p class="desc" style="color:#b3aaa0">시행일: ${TODAY}</p>`;
  write(`privacy/index.html`, page({title:`개인정보처리방침 | APPAWTG`,desc:`APPAWTG 개인정보처리방침. 회원가입 없는 정적 사이트, 분석 쿠키 및 한줄평 저장에 관한 안내.`,canonical:`${SITE}/privacy/`,jsonld:null,body}));
  urls.push({loc:`${SITE}/privacy/`,pri:"0.3"});
}

// ----- sitemap.xml -----
const sm=`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
${urls.map(u=>`  <url><loc>${u.loc}</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>${u.pri}</priority></url>`).join("\n")}
</urlset>`;
write("sitemap.xml", sm);
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
// ----- 앱 본체 + 커스텀도메인 포함 (배포 산출물 완성) -----
// 슬러그맵(이름->슬러그) — 인앱 시트의 상세페이지 링크용
const slugmap={}; ALL.forEach(p=>{ slugmap[p.n]=p.slug; });
fs.writeFileSync(path.join(OUT,"slugmap.js"), "window.SLUGMAP="+JSON.stringify(slugmap)+";");
// 앱 본체 복사 (index.html에는 slugmap.js 로더 주입)
if(fs.existsSync("index.html")){
  let html=fs.readFileSync("index.html","utf8");
  if(!html.includes("slugmap.js")) html=html.replace("\n</body>", "\n<script src=\"/slugmap.js\"></script>\n</body>");
  if(!html.includes("info_auto.js")) html=html.replace("\n</body>", "\n<script src=\"/info_auto.js\"></script>\n</body>");
  fs.writeFileSync(path.join(OUT,"index.html"), html);
}
if(fs.existsSync("places_extra.js")) fs.copyFileSync("places_extra.js", path.join(OUT,"places_extra.js"));
if(fs.existsSync("info_auto.js")) fs.copyFileSync("info_auto.js", path.join(OUT,"info_auto.js"));
fs.writeFileSync(path.join(OUT,"CNAME"), "appawtg.com\n");


console.log("총 장소:", ALL.length);
console.log("장소 페이지:", ALL.length);
console.log("조합 목록 페이지(>=4곳):", liveCombos.length, "/ 후보", COMBOS.length);
console.log("sitemap URL 수:", urls.length+1);

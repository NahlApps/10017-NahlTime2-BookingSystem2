// /js/ux-intro.js
// Intro slides, multi-step progress, summary chips, dynamic backgrounds & layout observers

const orderedPages=["page1","page2","page3","page4","page5","page6","page7"];
const STEPS_LABELS=["الترحيب","الخدمة","الوقت","البيانات","الدفع","الموقع","تم"];
const STEPS_LABELS_EN=["Welcome","Service","Time","Details","Payment","Location","Done"];
const PAGE_BACKGROUNDS={
  page1:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG1.jpg",
  page2:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG2.jpg",
  page3:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG3.jpg",
  page4:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG4.jpg",
  page5:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG5.jpg",
  page6:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG6.jpg",
  page7:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG7.jpg"
};
const STEP_GROUP_INDEX={page1:0,page2:1,page3:2,page4:3,page5:4,page6:5,page7:6};

function setPageBackground(id){ document.documentElement.style.setProperty('--page-bg', `url("${PAGE_BACKGROUNDS[id]||PAGE_BACKGROUNDS.page1}")`); }

function showPage(idx){
  const cur=document.querySelector('.page.active');
  const next=document.getElementById(orderedPages[idx]); if(!next||cur===next) return;
  if(cur && cur.id==='page1') stopWelcomeDeck();
  if(cur){ cur.classList.remove('active'); cur.classList.add('exit'); }
  next.style.display='flex';
  requestAnimationFrame(()=>{ next.classList.add('active'); setTimeout(()=>{ if(cur){cur.classList.remove('exit'); cur.style.display='none';} }, 240); });

  syncProgress(idx);
  setPageBackground(next.id);
  renderSummary(next.id);
  updateNextAvailability();
  if(next.id==='page1') startWelcomeDeck();
  if(next.id==='page6'){
    requestAreaBoundsForCurrentArea();
  }
}
function getActiveIndex(){ const id=document.querySelector('.page.active')?.id; return Math.max(0, orderedPages.indexOf(id)); }
function syncProgress(i){
  const pct=((i+1)/orderedPages.length)*100;
  document.getElementById('miniBarFill').style.width=pct+'%';

  const isEn = isEnglishLocale();
  const labels = isEn ? STEPS_LABELS_EN : STEPS_LABELS;
  document.getElementById('miniStepTitle').textContent=labels[Math.min(i,labels.length-1)];

  const prev=document.getElementById('footer-prev');
  const next=document.getElementById('footer-next');
  const wait=document.getElementById('footer-wait');
  const onThanks=(orderedPages[i]==='page7');
  prev.classList.toggle('hidden', i===0 || onThanks);
  next.classList.toggle('hidden', onThanks);
  wait.classList.remove('show');

  if (isEn){
    next.textContent = (i===0) ? 'Skip intro' : 'Next';
  } else {
    next.textContent = (i===0) ? 'تخطي العرض' : 'التالي';
  }
}

function renderSummary(currentId){
  const wrap=document.getElementById('summaryChips'); if(!wrap) return;
  const activeId=currentId || (document.querySelector('.page.active')?.id) || 'page1';
  const currGroup=STEP_GROUP_INDEX[activeId] ?? 0;

  wrap.style.display = currGroup === 0 ? 'none' : 'flex';
  if(currGroup===0){ wrap.innerHTML=''; return; }

  const areaTxt=$('#area').find(':selected').text()||'';
  const srvTxt=$('#service').find(':selected').text()||'';
  const dt=nForm.date ? DateTime.fromISO(nForm.date).toFormat('d LLL yyyy') : '';
  const tm=nForm.time||'';
  const pay=(nForm.paymentMethod||'');
  const locOk=!!positionUrl;
  const extras=(nForm.additionalServicesLabels||[]).join('، ');
  const couponTxt = couponCodeApplied ? couponCodeApplied : '';

  const chips=[
    {i:'fa-location-dot',t:'المنطقة',v:areaTxt,g:1},
    {i:'fa-screwdriver-wrench',t:'الخدمة',v:srvTxt,g:1},
    {i:'fa-plus',t:'خدمات إضافية',v:extras,g:1},
    {i:'fa-ticket',t:'الكوبون',v:couponTxt,g:4},
    {i:'fa-clock',t:'الموعد',v:(dt&&tm)?`${dt} • ${tm}`:'',g:2},
    {i:'fa-credit-card',t:'الدفع',v:(pay?pay.toUpperCase():''),g:4},
    {i:'fa-map-pin',t:'الموقع',v:(locOk?'تم التحديد':''),g:5},
  ];

  wrap.innerHTML='';
  chips.filter(c=>c.v && c.g<=currGroup).forEach(c=>{
    const el=document.createElement('div');
    el.className='chip'+(c.g===currGroup?' current':'' );
    el.innerHTML=`<i class="fa-solid ${c.i}"></i><span class="title">${c.t}:</span><span class="value">${c.v}</span>`;
    wrap.appendChild(el);
  });
}

let deckTimers=[]; let deckIndex=0; let deckRunning=false;
const SLIDE_MS=2600; const GAP_MS=220;
function startWelcomeDeck(){
  const deck=document.getElementById('pptDeck'); if(!deck) return;
  const slides=[...deck.querySelectorAll('.ppt-slide')];
  const dotsWrap=document.getElementById('pptDots');
  dotsWrap.innerHTML=slides.map((_,i)=>`<span class="ppt-dot${i===0?' active':''}"></span>`).join('');
  const dots=[...dotsWrap.children];

  const setActive=(i,ex=-1)=>{
    slides.forEach((s,idx)=>{ s.classList.remove('is-active','is-exiting'); if(idx===i){s.classList.add('is-active'); s.style.zIndex=2;} else if(idx===ex){s.classList.add('is-exiting'); s.style.zIndex=1;} else{s.style.zIndex=0;} });
    dots.forEach((d,idx)=>d.classList.toggle('active', idx===i));
  };
  deckRunning=true; deckIndex=0; setActive(0,-1);
  const advance=()=>{ if(!deckRunning) return; const prev=deckIndex; deckIndex++; if(deckIndex>=slides.length){ stopWelcomeDeck(); showPage(1); return; } setActive(deckIndex,prev); schedule(); };
  const schedule=()=>{ deckTimers.push(setTimeout(advance, SLIDE_MS+GAP_MS)); };
  schedule();
}
function stopWelcomeDeck(){ deckRunning=false; deckTimers.forEach(clearTimeout); deckTimers=[]; }

function installResizeObservers(){
  const header=document.getElementById('siteHeader');
  const footer=document.getElementById('siteFooter');
  const ro=new ResizeObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.target.id==='siteHeader') document.documentElement.style.setProperty('--header-h', entry.contentRect.height+'px');
      if(entry.target.id==='siteFooter') document.documentElement.style.setProperty('--footer-h', entry.contentRect.height+'px');
    });
  });
  header && ro.observe(header); footer && ro.observe(footer);
}

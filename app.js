'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const NAMES = ['Ivy','Ryan','11','Shwe','Php','Chaw','Win','NLO','Myo','Wai','22','Vino'];
const MO = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
const NUM_SEATS = 7;
const MAX_HIST = 5;

// ============================================================
// STATE
// ============================================================
let BUY = 5;
let seats = [];
let history = [];
let gameStart = Date.now();
let timerTick = null;

// ============================================================
// LOCALSTORAGE — GAME STATE
// ============================================================
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k,v) => { try { localStorage.setItem(k,v); } catch {} };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch {} };

function persist(){
  lsSet('sc3_seats', JSON.stringify(seats));
  lsSet('sc3_history', JSON.stringify(history));
  lsSet('sc3_buy', String(BUY));
  lsSet('sc3_start', String(gameStart));
}
function hydrate(){
  try{
    const s = lsGet('sc3_seats'); if(s) seats = JSON.parse(s) || [];
    const h = lsGet('sc3_history'); if(h) history = JSON.parse(h) || [];
    const b = lsGet('sc3_buy'); if(b && Number.isFinite(+b)) BUY = +b;
    const st = lsGet('sc3_start'); if(st && Number.isFinite(+st)) gameStart = +st;
    if(!Array.isArray(seats)) seats = [];
    if(!Array.isArray(history)) history = [];
  }catch{
    seats = [];
    history = [];
  }
}

// ============================================================
// LOCALSTORAGE — MONTHLY BUCKETS
// ============================================================
function monthKey(year,month){ return `pokerMonthly-${year}-${String(month).padStart(2,'0')}`; }
function getMBucket(year,month){
  try{ return JSON.parse(localStorage.getItem(monthKey(year,month)) || '[]') || []; } catch { return []; }
}
function saveMBucket(year,month,data){ lsSet(monthKey(year,month), JSON.stringify(data)); }
function getAllMonthlyKeys(){
  try{ return Object.keys(localStorage).filter(k=>k.startsWith('pokerMonthly-')); } catch { return []; }
}
function getAllMonthlyData(){
  const all = [];
  getAllMonthlyKeys().forEach(k=>{
    try{ all.push(...(JSON.parse(localStorage.getItem(k) || '[]') || [])); } catch {}
  });
  return all;
}

// ============================================================
// MONTHLY HELPERS
// ============================================================
const makeId = () => 'e' + Date.now() + Math.floor(Math.random()*1e6);

function monthlyHasEvent(eid){
  const now = new Date();
  const cur = getMBucket(now.getFullYear(), now.getMonth()+1);
  if(cur.some(e=>e.eid===eid)) return true;
  return getAllMonthlyData().some(e=>e.eid===eid);
}

function logPaymentToMonthly(eid,from,to,amount){
  if(!from || !to || from===to || !Number.isFinite(amount) || amount<=0) return;
  if(monthlyHasEvent(eid)) return;
  const now = new Date();
  const yr = now.getFullYear();
  const mo = now.getMonth()+1;
  const iso = now.toISOString();
  const data = getMBucket(yr,mo);
  const base = Date.now();
  // Store the real game date so Monthly can show the day within the month.
  data.push({id:base,   eid, date:iso, player:to,   month:mo, year:yr, result:'win',  amount, note:`Inside — from ${from}`,  source:'inside'});
  data.push({id:base+1, eid, date:iso, player:from, month:mo, year:yr, result:'loss', amount, note:`Inside — paid to ${to}`, source:'inside'});
  saveMBucket(yr,mo,data);
}

function logOutsideToMonthly(playerName,result,amount,note){
  const now = new Date();
  const yr = now.getFullYear();
  const mo = now.getMonth()+1;
  const iso = now.toISOString();
  const eid = makeId();
  const data = getMBucket(yr,mo);
  data.push({id:Date.now()+Math.random(), eid, date:iso, player:playerName, month:mo, year:yr, result, amount, note:note||'Outside cash (from Game Night)', source:'outside'});
  saveMBucket(yr,mo,data);
  return eid;
}

function removeMonthlyByEid(eid){
  getAllMonthlyKeys().forEach(k=>{
    try{
      const arr = JSON.parse(localStorage.getItem(k)||'[]') || [];
      const filtered = arr.filter(e=>e.eid!==eid);
      if(filtered.length!==arr.length) lsSet(k, JSON.stringify(filtered));
    }catch{}
  });
}

// ============================================================
// INIT
// ============================================================
function newSeats(){
  seats = [];
  for(let i=1;i<=NUM_SEATS;i++){
    seats.push({num:i, prev:[], p:{name:'Player '+i, buyIns:1, loans:[], payments:[], status:'active', joined:Date.now()}});
  }
}

function boot(){
  hydrate();
  if(!seats.length) newSeats();
  const bi = document.getElementById('buyInInput');
  if(bi) bi.value = String(BUY);
  startTimer();
  render();
  initMonthlyFilters();
}

// ============================================================
// TIMER
// ============================================================
const pad = (n)=>String(n).padStart(2,'0');
function startTimer(){
  if(timerTick) clearInterval(timerTick);
  timerTick = setInterval(()=>{
    const d = Date.now()-gameStart;
    const h = Math.floor(d/3600000), m = Math.floor((d%3600000)/60000), s = Math.floor((d%60000)/1000);
    const el = document.getElementById('timerEl');
    if(el) el.textContent = `Game Time: ${pad(h)}:${pad(m)}:${pad(s)}`;
  }, 1000);
}

// ============================================================
// TABS
// ============================================================
function showTab(name){
  document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('on', ['game','monthly'][i]===name));
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
  const pane = document.getElementById('pane-'+name);
  if(pane) pane.classList.add('on');
  if(name==='monthly'){ initMonthlyFilters(); renderMonthly(); }
}

// ============================================================
// UI UTILS
// ============================================================
const showErr = (msg)=>{
  const n = document.getElementById('errNote');
  if(!n) return;
  n.textContent = '⚠ ' + msg;
  n.style.display = 'block';
  setTimeout(()=>{ n.style.display='none'; }, 3500);
};

// ============================================================
// PLAYER HELPERS
// ============================================================
function allPlayers(){
  const out = [];
  seats.forEach(s=>{
    (s.prev||[]).forEach(p=>out.push({...p, seatNum:s.num}));
    out.push({...s.p, seatNum:s.num});
  });
  return out;
}
function takenNames(){
  const t = new Set();
  seats.forEach(s=>{
    const n = (s.p?.name||'').trim();
    if(NAMES.includes(n)) t.add(n);
  });
  return t;
}
function nameTakenElsewhere(name,si){
  const t = (name||'').trim();
  if(!t) return false;
  for(let i=0;i<seats.length;i++){
    if(i===si) continue;
    if((seats[i].p?.name||'').trim()===t) return true;
    if((seats[i].prev||[]).some(p=>((p.name||'').trim()===t))) return true;
  }
  return false;
}
function playerOpts(selfName){
  const seen = new Set();
  return allPlayers()
    .filter(p=>{
      const n = (p.name||'').trim();
      return n && n!==selfName && NAMES.includes(n) && !seen.has(n) && (seen.add(n), true);
    })
    .map(p=>`<option value="${p.name}">${p.name}${p.status==='left'?' (left)':''} S${p.seatNum}</option>`)
    .join('');
}

// ============================================================
// TOTALS / BALANCE
// ============================================================
function calcTotals(){
  const all = allPlayers();
  let pot=0, paid=0;
  all.forEach(p=>{
    pot += (p.buyIns||0)*BUY + (p.loans||[]).reduce((s,l)=>s+(l.amount||0),0);
    paid += (p.payments||[]).reduce((s,pm)=>s+(pm.amount||0),0);
  });
  return {pot, paid, bal: pot-paid};
}
function updateStats(){
  let active=0,left=0,total=0;
  seats.forEach(s=>{
    if(s.p?.status==='active') active++;
    total++;
    total += (s.prev||[]).length;
    left += (s.prev||[]).length;
  });
  const a=document.getElementById('sActive'), t=document.getElementById('sTotal'), l=document.getElementById('sLeft');
  if(a) a.textContent=String(active);
  if(t) t.textContent=String(total);
  if(l) l.textContent=String(left);
}
function updateBal(){
  const {pot,paid,bal} = calcTotals();
  const potEl = document.getElementById('potEl');
  if(potEl) potEl.textContent = `Total Pot: $${pot} | Paid Out: $${paid}`;
  const el = document.getElementById('balEl');
  if(!el) return;
  if(bal===0){ el.textContent='Balance: Perfect ✓'; el.className='bal'; }
  else if(bal>0){ el.textContent=`Missing $${bal} in payouts`; el.className='bal err'; }
  else { el.textContent=`Over by $${Math.abs(bal)}`; el.className='bal err'; }
}

// ============================================================
// SETTLEMENTS / SUMMARY
// ============================================================
function calcSettlements(){
  const raw = [];
  allPlayers().forEach(p=>{
    (p.payments||[]).forEach(pm=>raw.push({from:p.name,to:pm.to,amount:pm.amount}));
    (p.loans||[]).forEach(l=>raw.push({from:p.name,to:l.from,amount:l.amount}));
  });
  const map = new Map();
  raw.forEach(r=>{
    if(!r.from || !r.to || r.from===r.to) return;
    const k = r.from+'|'+r.to;
    map.set(k, (map.get(k)||0) + (r.amount||0));
  });
  const out=[], seen=new Set();
  for(const [k,amt] of map.entries()){
    if(seen.has(k)) continue;
    const [a,b] = k.split('|');
    const rk = b+'|'+a;
    const ra = map.get(rk)||0;
    const net = amt - ra;
    seen.add(k); seen.add(rk);
    if(net>0) out.push({from:a,to:b,amount:net});
    else if(net<0) out.push({from:b,to:a,amount:Math.abs(net)});
  }
  return out.sort((x,y)=>y.amount-x.amount);
}
function renderSettlements(){
  const all = allPlayers();
  const has = all.some(p=>((p.payments||[]).length || (p.loans||[]).length));
  const panel = document.getElementById('settlePanel');
  if(!panel) return;
  if(!has){ panel.style.display='none'; return; }
  const settled = calcSettlements();
  if(!settled.length){ panel.style.display='none'; return; }
  panel.style.display='block';
  const list = document.getElementById('settleList');
  if(list) list.innerHTML = settled.map(s=>`<div class="sitem"><span><strong>${s.from}</strong> owes <strong>${s.to}</strong></span><div class="samt">$${s.amount}</div></div>`).join('');
}
function renderSummary(){
  const panel = document.getElementById('summaryPanel');
  if(!panel) return;
  panel.style.display='block';
  const all = allPlayers();
  const recvMap = {};
  all.forEach(p=>{
    (p.payments||[]).forEach(pm=>{ recvMap[pm.to] = (recvMap[pm.to]||0) + (pm.amount||0); });
    (p.loans||[]).forEach(l=>{ recvMap[l.from] = (recvMap[l.from]||0) + (l.amount||0); });
  });
  const rows = all.map(p=>{
    const spent = (p.buyIns||0)*BUY + (p.loans||[]).reduce((s,l)=>s+(l.amount||0),0);
    const won = recvMap[p.name]||0;
    return {name:p.name, spent, won, net: won-spent, status:p.status, seatNum:p.seatNum};
  }).sort((a,b)=>b.net-a.net);
  const list = document.getElementById('summaryList');
  if(!list) return;
  const pot = rows.reduce((s,r)=>s+r.spent,0);
  const out = rows.reduce((s,r)=>s+r.won,0);
  list.innerHTML =
    `<div style="background:var(--lilac);padding:8px;border-radius:7px;color:var(--gold2);font-weight:700;margin-bottom:9px;">${rows.length} players • Pot: $${pot} • Out: $${out}</div>` +
    rows.map(r=>{
      let lbl='$0', cls='nz', icon='⚖️';
      if(r.spent===0 && r.won===0){ lbl='No play'; icon='⭕'; }
      else if(r.net>0){ lbl=`+$${r.net}`; cls='np'; icon='🏆'; }
      else if(r.net<0){ lbl=`-$${Math.abs(r.net)}`; cls='nn'; icon='📉'; }
      return `<div class="sitem">
        <div>
          <strong>${r.name}</strong>${r.status==='left'?' <span class="pill pill-l">LEFT</span>':''}
          <span style="color:var(--muted);font-size:11px;margin-left:4px;">S${r.seatNum}</span>
          <div style="font-size:11px;color:var(--muted);margin-top:1px;">Spent $${r.spent} • Won $${r.won}</div>
        </div>
        <div class="samt ${cls}">${icon} ${lbl}</div>
      </div>`;
    }).join('');
}

// ============================================================
// MONTHLY BADGES
// ============================================================
function monthBadges(playerName){
  const now = new Date(), mo = now.getMonth()+1, yr = now.getFullYear();
  let iw=0,il=0,ow=0,ol=0;
  getMBucket(yr,mo).forEach(e=>{
    if(e.player!==playerName) return;
    if(e.source==='inside'){ if(e.result==='win') iw+=e.amount; else il+=e.amount; }
    else { if(e.result==='win') ow+=e.amount; else ol+=e.amount; }
  });
  const hasIn = (iw+il)>0, hasOut=(ow+ol)>0;
  const sg = (n)=>n>0?'+':'';
  const cls = (n)=>n>0?'pill-w':n<0?'pill-l':'pill-i';
  let out='';
  if(hasIn && hasOut){
    const cn = (iw-il) + (ow-ol);
    out += `<span class="pill ${cls(cn)}" title="Combined this month">🧾 ${sg(cn)}$${cn}</span>`;
  }
  if(hasIn){
    const n = iw-il;
    out += `<span class="pill ${cls(n)}" title="Inside this month">🪙 ${sg(n)}$${n}</span>`;
  }
  if(hasOut){
    const n = ow-ol;
    out += `<span class="pill ${cls(n)}" title="Outside this month">💵 ${sg(n)}$${n}</span>`;
  }
  return out;
}

// ============================================================
// RENDER PLAYERS
// ============================================================
function render(){
  updateStats(); updateBal(); renderSettlements(); renderSummary();

  const grid = document.getElementById('gridEl');
  if(!grid) return;
  grid.innerHTML = '';

  const taken = takenNames();
  const all = allPlayers();
  const recvMap = {};
  all.forEach(p=>(p.payments||[]).forEach(pm=>{ recvMap[pm.to] = (recvMap[pm.to]||0) + (pm.amount||0); }));

  seats.forEach((seat,si)=>{
    const p = seat.p || {};
    const loanDebt = (p.loans||[]).reduce((s,l)=>s+(l.amount||0),0);

    const insideSpent = (p.buyIns||0)*BUY;
    const recv = recvMap[p.name] || 0;
    const insideNet = recv - insideSpent;

    const lossAmt = Math.max(0, -insideNet);
    const paid = (p.payments||[]).reduce((s,pm)=>s+(pm.amount||0),0);
    const leftToPay = Math.max(0, lossAmt - paid);

    let pcls='ev', ptxt='$0';
    if(p.status==='new'){ pcls='ev'; ptxt='New'; }
    else if(insideSpent===0 && recv===0){ pcls='ev'; ptxt='$0'; }
    else if(insideNet>0){ pcls='pr'; ptxt=`+$${insideNet}`; }
    else if(insideNet<0){
      if(leftToPay===0){ pcls='ev'; ptxt='$0 ✓'; }
      else { pcls='ls'; ptxt=`-$${lossAmt} ($${leftToPay} left)`; }
    } else { pcls='ev'; ptxt='$0'; }

    const nameOpts = NAMES.map(n=>{
      const sel = p.name===n;
      const dis = !sel && taken.has(n);
      return `<option value="${n}"${sel?' selected':''}${dis?' disabled':''}>${n}${dis?' ✗':''}</option>`;
    }).join('');

    const opts = playerOpts(p.name);

    const paidLine = lossAmt>0
      ? `💰 Paid: $${paid} of $${lossAmt} ${leftToPay>0 ? `($${leftToPay} left)` : '✓'}`
      : `💰 Paid: $${paid}`;

    const hasPayments = (p.payments||[]).length>0;
    let payInner = '';
    if(hasPayments || loanDebt>0){
      payInner = `<div style="background:rgba(200,220,240,.3);padding:8px;border:1.5px solid #a8ccee;border-radius:8px;margin-top:5px;">
        <div style="font-size:11px;font-weight:800;color:var(--wtx);margin-bottom:4px;">${paidLine}</div>
        ${loanDebt>0 ? `<div style="background:rgba(245,240,200,.65);padding:7px;border:1.5px solid #e0d890;border-radius:7px;margin-bottom:5px;">
          <div style="font-size:11px;font-weight:800;color:#7a6a30;margin-bottom:3px;">💵 Outside loans</div>
          ${(p.loans||[]).map((l,li)=>`
            <div class="entry">
              <span class="grow">Owes <b>${l.from}</b></span>
              <span style="font-weight:800;color:#7a6a30;">$${l.amount}</span>
              <button class="xbtn" data-action="remove-loan" data-seat="${si}" data-index="${li}" type="button">×</button>
            </div>`).join('')}
          <div style="font-size:11px;text-align:right;font-weight:800;color:#7a6a30;margin-top:2px;">Total: $${loanDebt}</div>
        </div>` : ''}
        ${hasPayments ? (p.payments||[]).map((pm,pi)=>`
          <div class="entry">
            <span class="grow">→ $${pm.amount} to ${pm.to}</span>
            <button class="xbtn" data-action="remove-payment" data-seat="${si}" data-index="${pi}" type="button">×</button>
          </div>`).join('') : ''}
      </div>`;
    }

    const card = document.createElement('div');
    card.className = 'pcard' + ((seat.prev||[]).length ? ' hs' : '');

    card.innerHTML = `
      <div class="row" style="justify-content:space-between;">
        <span class="seat-lbl">Seat ${seat.num}</span>
        <span class="profit ${pcls}">${ptxt}</span>
      </div>
      <div class="row">
        <select class="name-sel" data-action="rename" data-seat="${si}">
          <option value="">-- Name --</option>${nameOpts}
        </select>
        <span class="${p.status==='new' ? 'st-n':'st-a'}">${p.status==='new' ? 'NEW':'ACTIVE'}</span>
        <!-- Monthly badges removed from Game Night view to avoid showing totals from previous games. -->
      </div>
      <div class="row">
        ${p.status==='active'
          ? `<button class="btn btn-b" data-action="left" data-seat="${si}" type="button">🚪 Left</button>`
          : `<button class="btn btn-g" data-action="rejoin" data-seat="${si}" type="button">✅ Activate</button>`}
      </div>
      <div class="buyin-row">
        <button class="btn btn-r" data-action="buy" data-seat="${si}" data-delta="-1" type="button" ${p.buyIns<=0?'disabled':''}>-$${BUY}</button>
        <div class="buyin-box">${p.buyIns||0}×$${BUY}=$${insideSpent}${loanDebt ? ` <span style="color:var(--muted);">+$${loanDebt} loan</span>` : ''}</div>
        <button class="btn" data-action="buy" data-seat="${si}" data-delta="1" type="button">+$${BUY}</button>
      </div>

      <div class="sec sec-y">
        <div class="sec-lbl" style="color:#7a6a30;">💰 Borrowed from:</div>
        <div class="row">
          <select id="loanSel-${si}" style="flex:1;min-width:0;"><option value="">Choose lender...</option>${opts}</select>
          <button class="btn" data-action="loan" data-seat="${si}" type="button">Add</button>
        </div>
        ${(p.loans||[]).map((l,li)=>`
          <div class="entry">
            <span class="grow">📝 $${l.amount} → ${l.from}</span>
            <button class="xbtn" data-action="remove-loan" data-seat="${si}" data-index="${li}" type="button">×</button>
          </div>`).join('')}
      </div>

      <div class="sec sec-b">
        <div class="sec-lbl" style="color:#1a4a6a;">💸 Pay out:</div>
        <div class="row">
          <select id="payTo-${si}" style="flex:1;min-width:0;"><option value="">To player...</option>${opts}</select>
          <input id="payAmt-${si}" type="number" min="1" step="1" placeholder="$" style="width:60px;">
          <button class="btn" data-action="pay" data-seat="${si}" type="button">Pay</button>
        </div>
        ${payInner}
      </div>

      <div class="sec sec-y">
        <div class="sec-lbl" style="color:#7a6a30;">💵 Outside Cash:</div>
        <div class="row">
          <select id="outRes-${si}">
            <option value="win">Win 🏆</option>
            <option value="loss">Loss 📉</option>
          </select>
          <input id="outAmt-${si}" type="number" min="1" step="1" placeholder="$" style="width:60px;">
          <input id="outNote-${si}" type="text" placeholder="Note" style="width:100px;">
          <button class="btn" data-action="outside" data-seat="${si}" type="button">Add</button>
        </div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px;">Auto-logged to Monthly Tracker.</div>
      </div>

      ${(seat.prev||[]).length ? `<div style="background:var(--yellow);border:1.5px dashed #d0c060;border-left:4px solid #c0a830;padding:8px;border-radius:8px;margin-top:8px;">
        <strong style="font-size:11px;color:#7a6a20;">📜 Previous:</strong>
        ${(seat.prev||[]).map(pp=>`<div class="entry"><span class="grow"><b>${pp.name}</b> (left)</span><span>$${(pp.buyIns||0)*BUY+(pp.loans||[]).reduce((s,l)=>s+(l.amount||0),0)}</span></div>`).join('')}
      </div>` : ''}
    `;

    grid.appendChild(card);
  });
}

// ============================================================
// GAME ACTIONS
// ============================================================
function onBuyInChange(){
  const v = Math.round(+document.getElementById('buyInInput').value);
  if(!v || v<1) return;
  BUY = v;
  render();
  persist();
}
function changeBuy(si,d){
  if(!Number.isFinite(si) || !seats[si]) return;
  seats[si].p.buyIns = Math.max(0, (seats[si].p.buyIns||0) + d);
  render();
  persist();
}
function renameSeat(si,name){
  if(!Number.isFinite(si) || !seats[si]) return;
  name = (name||'').trim();
  if(!name) return;
  if(nameTakenElsewhere(name,si)){ alert(`"${name}" is already taken.`); render(); return; }
  const old = seats[si].p.name;
  seats[si].p.name = name;
  if(seats[si].p.status==='new'){
    seats[si].p.status='active';
    if(!seats[si].p.buyIns) seats[si].p.buyIns=1;
  }
  seats.forEach(s=>{
    (s.p.loans||[]).forEach(l=>{ if(l.from===old) l.from=name; });
    (s.p.payments||[]).forEach(pm=>{ if(pm.to===old) pm.to=name; });
  });
  render();
  persist();
}
function addLoan(si){
  if(!Number.isFinite(si) || !seats[si]) return;
  const sel = document.getElementById('loanSel-'+si);
  const lender = (sel?.value||'').trim();
  if(!lender){ showErr('Choose a lender'); return; }
  const p = seats[si].p;
  p.loans = p.loans || [];
  const ex = p.loans.find(l=>l.from===lender);
  if(ex) ex.amount += BUY;
  else p.loans.push({from:lender, amount:BUY});
  if(sel) sel.value='';
  render();
  persist();
}
function removeLoan(si,li){
  if(!Number.isFinite(si) || !seats[si]) return;
  const p = seats[si].p;
  if(!p.loans || !p.loans.length) return;
  if(!(li>=0 && li<p.loans.length)) return;
  p.loans.splice(li,1);
  render();
  persist();
}
function addPayment(si){
  if(!Number.isFinite(si) || !seats[si]) return;
  const to = (document.getElementById('payTo-'+si)?.value||'').trim();
  const amtEl = document.getElementById('payAmt-'+si);
  const amt = Math.round(+(amtEl?.value||0));
  if(!to){ showErr('Choose who to pay'); return; }
  if(!amt || amt<1){ showErr('Enter valid amount'); return; }
  const p = seats[si].p;
  p.payments = p.payments || [];
  const eid = makeId();
  p.payments.push({id:eid, to, amount:amt});
  logPaymentToMonthly(eid, p.name, to, amt);
  const toEl = document.getElementById('payTo-'+si);
  if(toEl) toEl.value='';
  if(amtEl) amtEl.value='';
  render();
  persist();
  if(document.getElementById('pane-monthly')?.classList.contains('on')) renderMonthly();
}
function removePayment(si,pi){
  if(!Number.isFinite(si) || !seats[si]) return;
  const p = seats[si].p;
  if(!p.payments || !p.payments.length) return;
  if(!(pi>=0 && pi<p.payments.length)) return;
  const removed = p.payments.splice(pi,1)[0];
  if(removed?.id) removeMonthlyByEid(removed.id);
  render();
  persist();
  if(document.getElementById('pane-monthly')?.classList.contains('on')) renderMonthly();
}
function playerLeft(si){
  if(!Number.isFinite(si) || !seats[si]) return;
  const seat = seats[si];
  const name = seat.p?.name || `Seat ${seat.num}`;
  if(!confirm(`${name} is leaving?`)) return;
  const arch = JSON.parse(JSON.stringify(seat.p));
  arch.status = 'left';
  seat.prev = seat.prev || [];
  seat.prev.push(arch);
  seat.p = {name:'New '+seat.num, buyIns:0, loans:[], payments:[], status:'new', joined:Date.now()};
  render();
  persist();
}
function playerRejoin(si){
  if(!Number.isFinite(si) || !seats[si]) return;
  seats[si].p.status = 'active';
  if(!seats[si].p.buyIns) seats[si].p.buyIns = 1;
  render();
  persist();
}
function addOutside(si){
  if(!Number.isFinite(si) || !seats[si]) return;
  const p = seats[si].p;
  if(!NAMES.includes((p.name||'').trim())){ showErr('Please assign a player name first'); return; }
  const res = (document.getElementById('outRes-'+si)?.value || 'loss');
  const amtEl = document.getElementById('outAmt-'+si);
  const noteEl = document.getElementById('outNote-'+si);
  const amt = Math.round(+(amtEl?.value||0));
  if(!amt || amt<1){ showErr('Enter valid amount'); return; }
  const note = (noteEl?.value||'').trim();
  logOutsideToMonthly(p.name, res, amt, note);
  if(amtEl) amtEl.value='';
  if(noteEl) noteEl.value='';
  render();
  persist();
  if(document.getElementById('pane-monthly')?.classList.contains('on')) renderMonthly();
}

// ============================================================
// RESET / HISTORY / EXPORT / CLEAR
// ============================================================
function resetGame(){
  if(!confirm('Reset game? Current game saved to history.')) return;
  try{
    history = Array.isArray(history) ? history : [];
    history.unshift({date:new Date().toISOString(), seats:JSON.parse(JSON.stringify(seats)), gameStart, buy:BUY, end:Date.now()});
    if(history.length>MAX_HIST) history.splice(MAX_HIST);
    BUY = 5;
    newSeats();
    gameStart = Date.now();
    const bi=document.getElementById('buyInInput'); if(bi) bi.value='5';
    const sp=document.getElementById('settlePanel'); if(sp) sp.style.display='none';
    const sm=document.getElementById('summaryPanel'); if(sm) sm.style.display='none';
    persist();
    startTimer();
    render();
    if(document.getElementById('pane-monthly')?.classList.contains('on')){ initMonthlyFilters(); renderMonthly(); }
    alert('Game reset! Previous game saved to history.');
  }catch(e){
    console.error('resetGame failed', e);
    showErr('Reset failed: ' + (e?.message||e));
  }
}

function showHistory(){
  const list = document.getElementById('histList');
  const modal = document.getElementById('histModal');
  if(!list || !modal) return;
  if(!Array.isArray(history) || !history.length){
    list.innerHTML = '<p style="color:var(--muted);text-align:center;">No previous games.</p>';
    modal.classList.add('on');
    modal.setAttribute('aria-hidden','false');
    return;
  }
  list.innerHTML = history.map((g,i)=>{
    const d = new Date(g.date);
    const dur = (g.end||Date.now()) - (g.gameStart||Date.now());
    const hh = Math.floor(dur/3600000), mm = Math.floor((dur%3600000)/60000);
    let tp=0; (g.seats||[]).forEach(s=>{ tp++; tp += (s.prev||[]).length; });
    return `<div class="hitem">
      <strong>Game #${i+1}</strong> — ${d.toLocaleDateString()} ${d.toLocaleTimeString()}<br>
      Duration: ${hh}h ${mm}m • Players: ${tp} • Buy-in: $${g.buy||5}<br>
      <button class="btn" data-action="load-hist" data-index="${i}" type="button" style="margin-top:6px;">Load</button>
    </div>`;
  }).join('');
  modal.classList.add('on');
  modal.setAttribute('aria-hidden','false');
}

function loadHist(i){
  if(!confirm('Load this game? (Current game will be snapshotted first)')) return;
  try{
    if(!Array.isArray(history)) history = [];
    const targetIndex = i;

    history.unshift({date:new Date().toISOString(), seats:JSON.parse(JSON.stringify(seats)), gameStart, buy:BUY, end:Date.now()});
    if(history.length>MAX_HIST+1) history.splice(MAX_HIST+1);

    if(targetIndex<0 || targetIndex>=history.length-1){ showErr('That history item no longer exists.'); return; }
    const g = history[targetIndex+1];
    if(!g || !g.seats){ showErr('Could not load that game (history item missing).'); return; }

    seats = JSON.parse(JSON.stringify(g.seats));
    gameStart = g.gameStart || Date.now();
    BUY = g.buy || 5;

    const bi = document.getElementById('buyInInput');
    if(bi) bi.value = String(BUY);

    persist();
    startTimer();
    render();
    closeModal();
    if(document.getElementById('pane-monthly')?.classList.contains('on')){ initMonthlyFilters(); renderMonthly(); }
  }catch(e){
    console.error(e);
    showErr('Load failed: ' + (e?.message||e));
  }
}

function closeModal(){
  const modal = document.getElementById('histModal');
  if(!modal) return;
  modal.classList.remove('on');
  modal.setAttribute('aria-hidden','true');
}

function exportData(){
  const buckets = {};
  getAllMonthlyKeys().forEach(k=>{
    try{ buckets[k] = JSON.parse(localStorage.getItem(k)||'[]') || []; } catch { buckets[k]=[]; }
  });
  const payload = {
    currentGame:{seats, gameStart, buy:BUY, exported:new Date().toISOString()},
    history,
    monthly:{keys:Object.keys(buckets).sort(), buckets}
  };
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload,null,2));
  a.download = 'shirley-casino-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  alert(`Exported! Monthly buckets: ${Object.keys(buckets).length}`);
}

function showReport(){
  let r = 'PLAYERS REPORT\\n==============\\n\\n';
  seats.forEach(s=>{
    r += `Seat ${s.num}\\n`;
    (s.prev||[]).forEach(p=>{ r += `  ${p.name} (LEFT) in:$${(p.buyIns||0)*BUY}\\n`; });
    r += `  ${s.p.name} (${String(s.p.status||'').toUpperCase()}) in:$${(s.p.buyIns||0)*BUY}\\n\\n`;
  });
  const all = allPlayers();
  r += `Total:${all.length} | Active:${all.filter(p=>p.status==='active').length} | Left:${all.filter(p=>p.status==='left').length}`;
  alert(r);
}

function clearAll(){
  if(!confirm('Clear ALL data? Cannot be undone.')) return;
  ['sc3_seats','sc3_history','sc3_buy','sc3_start'].forEach(lsDel);
  getAllMonthlyKeys().forEach(lsDel);
  BUY=5;
  history=[];
  gameStart=Date.now();
  newSeats();
  const bi=document.getElementById('buyInInput'); if(bi) bi.value='5';
  const sp=document.getElementById('settlePanel'); if(sp) sp.style.display='none';
  const sm=document.getElementById('summaryPanel'); if(sm) sm.style.display='none';
  persist();
  startTimer();
  render();
  alert('All data cleared.');
}

// ============================================================
// MONTHLY TRACKER
// ============================================================
function initMonthlyFilters(){
  const now = new Date();
  const fy = document.getElementById('fYear');
  if(fy){
    const keys = getAllMonthlyKeys();
    const years = new Set();
    keys.forEach(k=>{
      const parts = k.split('-');
      const y = parseInt(parts[1],10);
      if(Number.isFinite(y)) years.add(y);
    });
    years.add(now.getFullYear());
    const cur = fy.value || String(now.getFullYear());
    fy.innerHTML = '<option value="0">All</option>' + [...years].sort().map(y=>`<option value="${y}">${y}</option>`).join('');
    fy.value = cur || String(now.getFullYear());
  }
  const fp = document.getElementById('fPlayer');
  if(fp){
    const cur = fp.value;
    fp.innerHTML = '<option value="">All</option>' + NAMES.map(n=>`<option value="${n}">${n}</option>`).join('');
    fp.value = cur;
  }
  const fm = document.getElementById('fMonth');
  if(fm && (!fm.value || fm.value==='0')) fm.value = String(now.getMonth()+1);
}

function renderMonthly(){
  const fm = parseInt(document.getElementById('fMonth')?.value||'0',10);
  const fy = parseInt(document.getElementById('fYear')?.value||'0',10);
  const fp = (document.getElementById('fPlayer')?.value)||'';
  const fs = (document.getElementById('fSource')?.value)||'';

  let data = [];
  if(fy>0 && fm>0){
    data = getMBucket(fy,fm);
  }else if(fy>0 && fm===0){
    for(let m=1;m<=12;m++) data.push(...getMBucket(fy,m));
  }else if(fy===0 && fm>0){
    getAllMonthlyKeys().forEach(k=>{
      const p = k.split('-');
      const y = parseInt(p[1],10);
      const m = parseInt(p[2],10);
      if(m===fm) data.push(...getMBucket(y,m));
    });
  }else{
    data = getAllMonthlyData();
  }

  data = (data||[]).map(e=>({...e, source:e.source||'outside'}));
  if(fp) data = data.filter(e=>e.player===fp);
  if(fs) data = data.filter(e=>e.source===fs);

  let iw=0,il=0,ow=0,ol=0;
  data.forEach(e=>{
    if(e.source==='inside'){ if(e.result==='win') iw+=e.amount; else il+=e.amount; }
    else { if(e.result==='win') ow+=e.amount; else ol+=e.amount; }
  });
  const iN=iw-il, oN=ow-ol, cN=iN+oN;
  const cls = (n)=>n>0?'np':n<0?'nn':'nz';
  const sg = (n)=>n>0?'+':'';

  const tbar = document.getElementById('tbarEl');
  if(tbar){
    tbar.innerHTML = `
      <div style="font-weight:800;color:var(--gold2);margin-bottom:7px;">📈 Totals</div>
      <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
        <div>
          <div style="font-size:11px;color:var(--muted);font-weight:800;">COMBINED</div>
          <div class="${cls(cN)}" style="font-size:21px;font-weight:900;">${sg(cN)}$${cN}</div>
          <div style="font-size:11px;color:var(--muted);">+$${iw+ow} / -$${il+ol}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--muted);font-weight:800;">🪙 INSIDE</div>
          <div class="${cls(iN)}" style="font-size:17px;font-weight:900;">${sg(iN)}$${iN}</div>
          <div style="font-size:11px;color:var(--muted);">+$${iw} / -$${il}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--muted);font-weight:800;">💵 OUTSIDE</div>
          <div class="${cls(oN)}" style="font-size:17px;font-weight:900;">${sg(oN)}$${oN}</div>
          <div style="font-size:11px;color:var(--muted);">+$${ow} / -$${ol}</div>
        </div>
      </div>`;
  }

  const byP = {};
  data.forEach(e=>{
    if(!byP[e.player]) byP[e.player] = {iw:0,il:0,ow:0,ol:0};
    if(e.source==='inside'){ if(e.result==='win') byP[e.player].iw+=e.amount; else byP[e.player].il+=e.amount; }
    else { if(e.result==='win') byP[e.player].ow+=e.amount; else byP[e.player].ol+=e.amount; }
  });

  const rows = Object.entries(byP).map(([name,s])=>({
    name,
    won: s.iw+s.ow,
    lost: s.il+s.ol,
    iN: s.iw-s.il,
    oN: s.ow-s.ol,
    net: (s.iw-s.il)+(s.ow-s.ol)
  })).sort((a,b)=>b.net-a.net);

  const totTbody = document.getElementById('totTbody');
  if(totTbody){
    totTbody.innerHTML = rows.length
      ? rows.map(r=>`<tr>
          <td><strong>${r.name}</strong></td>
          <td class="wc">+$${r.won}</td>
          <td class="lc">-$${r.lost}</td>
          <td class="${cls(r.net)}">${sg(r.net)}$${r.net}</td>
          <td class="${cls(r.iN)}">${sg(r.iN)}$${r.iN}</td>
          <td class="${cls(r.oN)}">${sg(r.oN)}$${r.oN}</td>
        </tr>`).join('')
      : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:10px;">No data.</td></tr>`;
  }

  const cards = document.getElementById('mCards');
  if(cards){
    cards.innerHTML = rows.length
      ? rows.map(r=>`<div class="mcard">
          <div style="font-weight:800;font-size:14px;">${r.name}</div>
          <div class="${cls(r.net)}" style="font-size:19px;font-weight:900;">${sg(r.net)}$${r.net}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:5px;">
            🪙 <span class="${cls(r.iN)}">${sg(r.iN)}$${r.iN}</span>
            &nbsp; 💵 <span class="${cls(r.oN)}">${sg(r.oN)}$${r.oN}</span>
          </div>
        </div>`).join('')
      : '';
  }

  const tbody = document.getElementById('detTbody');
  const empty = document.getElementById('mEmpty');
  const ts = (x)=>{
    const t = x?.date ? Date.parse(x.date) : NaN;
    return Number.isFinite(t) ? t : Date.UTC((x?.year||1970), (x?.month||1)-1, 1);
  };
  const sorted = [...data].sort((a,b)=>ts(b)-ts(a) || (b.id||0)-(a.id||0));
  if(!tbody) return;
  if(!sorted.length){
    tbody.innerHTML = '';
    if(empty) empty.style.display='block';
    return;
  }
  if(empty) empty.style.display='none';
  tbody.innerHTML = sorted.map(e=>{
    const sp = e.source==='inside' ? '<span class="pill pill-i">🪙 Inside</span>' : '<span class="pill pill-l">💵 Outside</span>';
    const rp = e.result==='win' ? '<span class="pill pill-w">🏆</span>' : '<span class="pill pill-l">📉</span>';
    const canDel = e.source==='outside';
    const delCell = canDel
      ? `<button class="del" data-action="del-entry" data-id="${e.id}" data-month="${e.month||0}" data-year="${e.year||0}" type="button">✕</button>`
      : `<span style="color:var(--muted);font-size:11px;">—</span>`;
    const dateStr = (()=>{
      const d = e.date ? new Date(e.date) : new Date(Date.UTC(e.year,(e.month||1)-1,1));
      return d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'2-digit'});
    })();
    return `<tr>
      <td><strong>${e.player}</strong></td>
      <td>${dateStr}</td>
      <td>${sp}</td>
      <td>${rp}</td>
      <td class="${e.result==='win'?'wc':'lc'}">${e.result==='win'?'+':'-'}$${e.amount}</td>
      <td style="color:var(--muted);font-size:11px;">${e.note||'—'}</td>
      <td>${delCell}</td>
    </tr>`;
  }).join('');
}

function delEntry(id,month,year){
  if(!confirm('Delete this outside entry?')) return;
  const buckets = (month>0 && year>0)
    ? [{year,month}]
    : getAllMonthlyKeys().map(k=>{
        const p=k.split('-');
        return {year:parseInt(p[1],10), month:parseInt(p[2],10)};
      });

  for(const b of buckets){
    const arr = getMBucket(b.year,b.month);
    const target = arr.find(e=>e.id===id);
    if(!target) continue;
    if(target.source==='inside'){ alert('Inside entries are automatic and cannot be deleted here.'); return; }
    const filtered = target.eid ? arr.filter(e=>e.eid!==target.eid) : arr.filter(e=>e.id!==id);
    saveMBucket(b.year,b.month,filtered);
    break;
  }
  renderMonthly();
  initMonthlyFilters();
  render();
}

// ============================================================
// EVENT WIRING
// ============================================================
window.addEventListener('DOMContentLoaded', ()=>{
  boot();

  document.getElementById('tabGame')?.addEventListener('click', ()=>showTab('game'));
  document.getElementById('tabMonthly')?.addEventListener('click', ()=>showTab('monthly'));

  document.getElementById('btnReset')?.addEventListener('click', resetGame);
  document.getElementById('btnHistory')?.addEventListener('click', showHistory);
  document.getElementById('btnExport')?.addEventListener('click', exportData);
  document.getElementById('btnReport')?.addEventListener('click', showReport);
  document.getElementById('btnClearAll')?.addEventListener('click', clearAll);

  document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
  document.getElementById('histModal')?.addEventListener('click', (e)=>{ if(e.target===document.getElementById('histModal')) closeModal(); });

  document.getElementById('buyInInput')?.addEventListener('change', onBuyInChange);

  ['fMonth','fYear','fPlayer','fSource'].forEach(id=>{
    document.getElementById(id)?.addEventListener('change', renderMonthly);
  });

  document.getElementById('gridEl')?.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    const action = btn.dataset.action;
    const si = Number(btn.dataset.seat);

    if(action==='left') return playerLeft(si);
    if(action==='rejoin') return playerRejoin(si);
    if(action==='buy'){
      const d = Number(btn.dataset.delta);
      if(Number.isFinite(d)) return changeBuy(si,d);
      return;
    }
    if(action==='loan') return addLoan(si);
    if(action==='pay') return addPayment(si);
    if(action==='outside') return addOutside(si);
    if(action==='remove-payment'){
      const idx = Number(btn.dataset.index);
      if(Number.isFinite(idx)) return removePayment(si,idx);
      return;
    }
    if(action==='remove-loan'){
      const idx = Number(btn.dataset.index);
      if(Number.isFinite(idx)) return removeLoan(si,idx);
      return;
    }
  });

  document.getElementById('gridEl')?.addEventListener('change', (e)=>{
    const sel = e.target.closest('select[data-action="rename"]');
    if(!sel) return;
    const si = Number(sel.dataset.seat);
    if(Number.isFinite(si)) renameSeat(si, sel.value);
  });

  document.getElementById('histList')?.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action="load-hist"]');
    if(!btn) return;
    loadHist(Number(btn.dataset.index));
  });

  document.getElementById('detTbody')?.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action="del-entry"]');
    if(!btn) return;
    delEntry(Number(btn.dataset.id), Number(btn.dataset.month), Number(btn.dataset.year));
  });

  document.getElementById('gridEl')?.addEventListener('keydown', (e)=>{
    if(e.key!=='Enter') return;
    const id = e.target?.id || '';
    if(id.startsWith('payAmt-')) addPayment(parseInt(id.replace('payAmt-',''),10));
    if(id.startsWith('outAmt-')) addOutside(parseInt(id.replace('outAmt-',''),10));
  });

  window.addEventListener('error', (e)=>showErr(`JS: ${e.message}`));
  window.addEventListener('unhandledrejection', (e)=>showErr(`Promise: ${e.reason?.message||e.reason}`));
});

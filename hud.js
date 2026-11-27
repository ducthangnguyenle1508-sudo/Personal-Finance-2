/* HUD tổng quan cho tab Đầu tư và Thu chi. Số tiền chính do app.js ghi, file này vẽ phần trực quan đi kèm. */
(function(){
'use strict';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hidden=()=>document.documentElement.classList.contains('hide-balances');
const percent=ratio=>(ratio*100).toLocaleString('vi-VN',{maximumFractionDigits:1})+'%';
const clamp=value=>Math.max(0,Math.min(100,value));
const compact=value=>hidden()?'••••':new Intl.NumberFormat('vi-VN',{notation:'compact',maximumFractionDigits:1}).format(value)+' ₫';
const signed=(value,fmt)=>hidden()?'••••':(value>0?'+':value<0?'−':'')+fmt(Math.abs(value));
const chip=(tone,text)=>'<span class="board-chip '+tone+'">'+esc(text)+'</span>';
/* Mũi tên + chữ để tăng/giảm không chỉ phân biệt bằng màu */
const arrow=value=>value>0?'▲ ':value<0?'▼ ':'● ';

/* ---------- Đầu tư ---------- */
function savedSnapshots(){try{const list=JSON.parse(localStorage.getItem('so-dau-tu-snapshots-v1')||'[]');return Array.isArray(list)?list.filter(item=>item&&/^\d{4}-\d{2}$/.test(item.month)&&Number.isFinite(Number(item.value))):[]}catch{return []}}
function localMonth(){const now=new Date();return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')}
function investment({total,debt,unrealized,cost,groups,mode,fmt}){
  if(!$('#investBoard'))return;
  $('#investMode').textContent='Tổng quan tài sản · theo '+(mode==='market'?'giá thị trường':'giá vốn');
  const chips=[];
  const previous=savedSnapshots().filter(item=>item.month<localMonth()).sort((a,b)=>a.month.localeCompare(b.month)).pop();
  if(previous&&Number(previous.value)>0){
    const change=total-Number(previous.value),month=previous.month.slice(5)+'/'+previous.month.slice(0,4);
    chips.push(chip(change>0?'up':change<0?'down':'',arrow(change)+'Tổng tài sản '+signed(change,fmt)+' ('+percent(Math.abs(change)/previous.value)+') so với '+month));
  }
  if(mode==='market'&&cost>0)chips.push(chip(unrealized>0?'up':unrealized<0?'down':'',arrow(unrealized)+(unrealized<0?'Lỗ ':unrealized>0?'Lãi ':'Hòa vốn · ')+percent(Math.abs(unrealized)/cost)+' trên vốn vàng, cổ phiếu'));
  $('#investChips').innerHTML=chips.join('');
  $('#unrealizedTotal').className=unrealized>0?'up':unrealized<0?'down':'';
  $('#netWorth').classList.toggle('down',total-debt<0);
  const ratio=total>0?debt/total:0;
  $('#debtRatio').textContent=total>0?percent(ratio):'—';
  $('#debtBar').style.width=clamp(ratio*100)+'%';

  /* Vòng cơ cấu: chỉ vẽ nhóm có giá trị dương, chừa khe giữa các cung */
  const positive=groups.filter(group=>group.value>0),sum=positive.reduce((acc,group)=>acc+group.value,0),gap=positive.length>1?0.6:0;
  let start=0;
  const arcs=positive.map(group=>{
    const size=group.value/sum*100,length=Math.max(0.2,size-gap),node='<circle cx="60" cy="60" r="48" pathLength="100" stroke="'+group.color+'" stroke-dasharray="'+length.toFixed(3)+' '+(100-length).toFixed(3)+'" stroke-dashoffset="'+(-start).toFixed(3)+'"><title>'+esc(group.label+' '+percent(group.value/sum))+'</title></circle>';
    start+=size;return node;
  }).join('');
  $('#investRing').innerHTML='<svg viewBox="0 0 120 120" role="img" aria-label="Cơ cấu tài sản"><circle class="ring-base" cx="60" cy="60" r="48"/><g transform="rotate(-90 60 60)">'+arcs+'</g></svg><div class="ring-center"><small>Tổng tài sản</small><strong>'+compact(total)+'</strong></div>';
  $('#investLegend').innerHTML=groups.map(group=>'<li><i style="background:'+group.color+'"></i><span>'+esc(group.label)+'</span><b>'+(sum>0?percent(Math.max(0,group.value)/sum):'—')+'</b></li>').join('');
}

/* ---------- Thu chi ---------- */
const parseDay=iso=>{const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d)};
const dayKey=date=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
const dayCount=(from,to)=>Math.round((Date.UTC(to.getFullYear(),to.getMonth(),to.getDate())-Date.UTC(from.getFullYear(),from.getMonth(),from.getDate()))/86400000)+1;
/* Kỳ trước để so sánh: nếu kỳ đang xem chưa kết thúc thì chỉ lấy cùng số ngày đầu kỳ */
function comparison(range,todayIso){
  const start=parseDay(range.start),week=range.mode==='week';
  const prevStart=week?new Date(start.getFullYear(),start.getMonth(),start.getDate()-7):new Date(start.getFullYear(),start.getMonth()-1,1);
  const prevEnd=new Date(start.getFullYear(),start.getMonth(),start.getDate()-1);
  const days=dayCount(start,parseDay(range.end));
  const state=todayIso<range.start?'future':todayIso>range.end?'past':'current';
  const passed=state==='past'?days:state==='future'?0:dayCount(start,parseDay(todayIso));
  let end=prevEnd;
  if(state==='current'&&passed<days){const cut=new Date(prevStart.getFullYear(),prevStart.getMonth(),prevStart.getDate()+passed-1);if(cut<end)end=cut}
  return {start:dayKey(prevStart),end:dayKey(end),days,passed,state,partial:state==='current'&&passed<days,unit:week?'tuần':'tháng'};
}
function delta(now,before,goodWhenUp,info){
  if(info.state==='future')return '';
  const name=(info.partial?'cùng kỳ ':'')+info.unit+' trước';
  if(!before)return chip('','Chưa có số liệu '+name);
  const change=(now-before)/before;
  if(Math.abs(change)<0.0005)return chip('','● Bằng '+name);
  return chip((change>0)===goodWhenUp?'up':'down',arrow(change)+percent(Math.abs(change))+' so với '+name);
}
function cashflow({range,today,income,expense,transactions,periodTransactions,amountOf,nameOf,fmt}){
  if(!$('#flowBoard'))return;
  const info=comparison(range,today),balance=income-expense;
  const before=transactions.filter(t=>(t.date||'')>=info.start&&(t.date||'')<=info.end);
  const totalOf=(list,type)=>list.filter(t=>t.type===type).reduce((sum,t)=>sum+amountOf(t,type),0);
  $('#flowEyebrow').textContent='Dòng tiền · '+range.label+(info.partial?' · ngày '+info.passed+'/'+info.days:'');
  const max=Math.max(income,expense,1);
  $('#incomeBar').style.width=clamp(income/max*100)+'%';$('#expenseBar').style.width=clamp(expense/max*100)+'%';
  $('#incomeDelta').innerHTML=delta(income,totalOf(before,'income'),true,info);
  $('#expenseDelta').innerHTML=delta(expense,totalOf(before,'expense'),false,info);

  const rate=income?balance/income:null,ring=$('#savingRing');
  ring.style.setProperty('--p',rate===null?0:clamp(rate*100));
  ring.classList.toggle('negative',rate!==null&&rate<0);
  $('#flowStatus').innerHTML=!income&&!expense?chip('','Chưa có thu chi trong kỳ'):balance<0?chip('down','▼ Chi vượt thu'):balance>0?chip('up','▲ Thu lớn hơn chi'):chip('','● Thu bằng chi');

  /* Trung bình ngày chỉ tính các khoản đã đến ngày */
  const spentToDate=periodTransactions.filter(t=>t.type==='expense'&&(t.date||'')<=today).reduce((sum,t)=>sum+amountOf(t,'expense'),0);
  const counted=periodTransactions.filter(t=>t.type==='income'||t.type==='expense');
  const largest=counted.filter(t=>t.type==='expense').map(t=>({t,amount:amountOf(t,'expense')})).filter(item=>item.amount>0).sort((a,b)=>b.amount-a.amount)[0];
  const tile=(label,value,note)=>'<div class="hud-tile"><span>'+label+'</span><strong>'+value+'</strong><small>'+note+'</small></div>';
  $('#flowTiles').innerHTML=
    tile('Chi trung bình mỗi ngày',info.passed?fmt(spentToDate/info.passed):'—',info.passed?'tính trên '+info.passed+' ngày':'kỳ chưa bắt đầu')+
    tile('Khoản chi lớn nhất',largest?fmt(largest.amount):'—',largest?esc(nameOf(largest.t))+' · '+esc(String(largest.t.date||'').split('-').reverse().join('/')):'chưa có khoản chi')+
    tile('Số giao dịch thu chi',String(counted.length),counted.filter(t=>t.type==='income').length+' thu · '+counted.filter(t=>t.type==='expense').length+' chi');

  const byName=new Map();
  periodTransactions.filter(t=>t.type==='expense').forEach(t=>{const amount=amountOf(t,'expense');if(amount){const name=nameOf(t);byName.set(name,(byName.get(name)||0)+amount)}});
  const top=Array.from(byName).sort((a,b)=>b[1]-a[1]).slice(0,3);
  $('#flowTop').innerHTML=top.length?top.map(([name,amount])=>'<li><div><span>'+esc(name)+'</span><b>'+(expense?percent(amount/expense):'—')+'</b></div><div class="hud-track"><i style="width:'+clamp(amount/(expense||1)*100)+'%"></i></div><small>'+fmt(amount)+'</small></li>').join(''):'<li class="board-empty">Chưa có khoản chi trong kỳ.</li>';
}
window.__hud={investment,cashflow,comparison};
})();

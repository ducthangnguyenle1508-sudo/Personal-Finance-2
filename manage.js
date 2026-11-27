/* Tab Quản lý: HUD tốc độ chi tiêu, tiến độ ngân sách theo danh mục, mục tiêu tiết kiệm */
(function(){
'use strict';
const STORE='so-dau-tu-saving-goals-v1';
const GAUGE_MAX=1.6;
const LEVELS={
  slow:{label:'Chậm hơn tiến độ',icon:'▽'},
  good:{label:'Chi tiêu tốt',icon:'✓'},
  fast:{label:'Chi tiêu nhanh',icon:'▲'},
  risk:{label:'Nguy cơ vượt ngân sách',icon:'!'},
  over:{label:'Đã vượt ngân sách',icon:'✕'},
  idle:{label:'Chưa bắt đầu',icon:'…'}
};
const $=selector=>document.querySelector(selector);
const openHistory=new Set();
let ctx=null;

/* ---------- Tính toán ---------- */
function monthInfo(month,todayIso){
  const [year,mon]=month.split('-').map(Number),days=new Date(year,mon,0).getDate(),current=todayIso.slice(0,7);
  const state=month<current?'past':month>current?'future':'current';
  const passed=state==='past'?days:state==='future'?0:Number(todayIso.slice(8,10));
  const left=state==='past'?0:state==='future'?days:days-passed+1;
  return {days,passed,left,state,elapsed:passed/days};
}
/* Spending Pace Index = % ngân sách đã dùng / % thời gian đã qua (làm tròn 2 số lẻ rồi mới xếp loại) */
function paceOf(spent,limit,elapsed){
  const used=limit>0?spent/limit:0;
  const index=limit>0&&elapsed>0?Math.round(used/elapsed*100)/100:null;
  let level='idle';
  if(limit>0&&spent>limit)level='over';
  else if(index!==null)level=index<0.8?'slow':index<=1?'good':index<=1.2?'fast':'risk';
  return {used,index,level};
}
const utcDay=iso=>{const [y,m,d]=String(iso).split('-').map(Number);return Date.UTC(y,m-1,d)/86400000};
function savingPace(goal,current,todayIso){
  const total=Math.max(1,utcDay(goal.deadline)-utcDay(goal.start)+1);
  const passed=Math.max(0,Math.min(total,utcDay(todayIso)-utcDay(goal.start)+1));
  const progress=goal.target>0?Math.max(0,current)/goal.target:0,elapsed=passed/total;
  const daysLeft=utcDay(goal.deadline)-utcDay(todayIso);
  const index=elapsed>0?Math.round(progress/elapsed*100)/100:null;
  let level,label;
  if(current>=goal.target){level='good';label='Hoàn thành'}
  else if(daysLeft<0){level='over';label='Quá hạn'}
  else if(index===null){level='idle';label='Chưa bắt đầu'}
  else if(index>=1){level='good';label='Đúng tiến độ'}
  else if(index>=0.8){level='fast';label='Chậm nhẹ'}
  else{level='risk';label='Chậm tiến độ'}
  return {progress,elapsed,index,daysLeft,level,label,remaining:Math.max(0,goal.target-current)};
}

/* ---------- Định dạng ---------- */
const esc=value=>ctx.A.esc(value);
const percent=ratio=>(ratio*100).toLocaleString('vi-VN',{maximumFractionDigits:ratio>0&&ratio<0.1?1:0})+'%';
const indexText=index=>index===null?'—':index>9.99?'9,99+':index.toFixed(2).replace('.',',');
const dateText=iso=>String(iso).split('-').reverse().join('/');
const clamp=value=>Math.max(0,Math.min(100,value));
const chip=(level,text)=>'<span class="pace-chip lv-'+level+'"><i aria-hidden="true">'+LEVELS[level].icon+'</i>'+esc(text)+'</span>';

/* ---------- Dữ liệu ngân sách của tháng đang chọn ---------- */
function budgetSnapshot(){
  const range=ctx.range(),month=range.month,info=monthInfo(month,ctx.today()),spending=ctx.spending(month);
  const rows=Object.entries(ctx.limits(month)).map(([id,limit])=>{
    const record=ctx.category(id),amount=Number(limit)||0,spent=spending[id]||0;
    return {id,record,name:record?.name||'Danh mục đã ẩn',limit:amount,spent,isDefault:ctx.isDefaultLimit(month,id),...paceOf(spent,amount,info.elapsed)};
  }).filter(row=>row.limit>0&&row.name!=='Cho vay');
  const order={over:0,risk:1,fast:2,good:3,slow:4,idle:5};
  rows.sort((a,b)=>order[a.level]-order[b.level]||b.used-a.used);
  const budgeted=new Set(rows.map(row=>row.id));
  const outside=Object.entries(spending).filter(([id])=>!budgeted.has(id))
    .map(([id,spent])=>({id,spent,name:ctx.category(id)?.name||'Khác'})).sort((a,b)=>b.spent-a.spent);
  const limit=rows.reduce((sum,row)=>sum+row.limit,0),spent=rows.reduce((sum,row)=>sum+row.spent,0);
  return {range,month,info,rows,outside,limit,spent,total:paceOf(spent,limit,info.elapsed)};
}

/* ---------- HUD ---------- */
function polar(value,radius){
  const angle=Math.PI*(1-Math.max(0,Math.min(GAUGE_MAX,value))/GAUGE_MAX);
  return [(150+radius*Math.cos(angle)).toFixed(2),(150-radius*Math.sin(angle)).toFixed(2)];
}
function arc(from,to,radius){const a=polar(from,radius),b=polar(to,radius);return 'M'+a.join(' ')+' A'+radius+' '+radius+' 0 0 1 '+b.join(' ')}
function gauge(index,level){
  const zones=[['slow',0,0.8],['good',0.8,1],['fast',1,1.2],['risk',1.2,GAUGE_MAX]];
  const active=index===null?'':index<0.8?'slow':index<=1?'good':index<=1.2?'fast':'risk';
  const segments=zones.map(([name,from,to])=>'<path class="gauge-zone z-'+name+(name===active?' active':'')+'" d="'+arc(from+0.008,to-0.008,112)+'"><title>'+LEVELS[name].label+'</title></path>').join('');
  const ticks=[0,0.8,1,1.2,GAUGE_MAX].map(value=>{const p=polar(value,134);return '<text class="gauge-tick" x="'+p[0]+'" y="'+(Number(p[1])+4)+'">'+(value?value.toFixed(1).replace('.',','):'0')+'</text>'}).join('');
  let needle='';
  if(index!==null){const tip=polar(index,100),base=polar(index,76);needle='<line class="gauge-needle" x1="'+base[0]+'" y1="'+base[1]+'" x2="'+tip[0]+'" y2="'+tip[1]+'"/><circle class="gauge-dot" cx="'+tip[0]+'" cy="'+tip[1]+'" r="5"/>'}
  return '<svg class="gauge" viewBox="0 0 300 168" role="img" aria-label="Spending Pace Index '+indexText(index)+', '+LEVELS[level].label+'"><path class="gauge-inner" d="'+arc(0,GAUGE_MAX,92)+'"/>'+segments+ticks+needle+'<text class="gauge-value" x="150" y="130">'+indexText(index)+'</text><text class="gauge-caption" x="150" y="152">SPENDING PACE INDEX</text></svg>';
}
function hudMessage(data){
  const {info,total,limit,spent}=data;
  if(!limit)return 'Đặt hạn mức cho ít nhất một danh mục để bắt đầu đo tốc độ chi tiêu.';
  if(info.state==='future')return 'Tháng này chưa bắt đầu, chỉ số sẽ có từ ngày đầu tháng.';
  if(spent>limit)return 'Tổng chi đã vượt ngân sách '+ctx.vnd(spent-limit)+'.';
  if(info.state==='past')return 'Tháng đã kết thúc, còn dư '+ctx.vnd(limit-spent)+' so với ngân sách.';
  if(total.level==='slow')return 'Bạn đang chi chậm hơn tiến độ thời gian. Còn nhiều dư địa cho phần còn lại của tháng.';
  if(total.level==='good')return 'Nhịp chi khớp với tiến độ thời gian. Giữ vững nhé.';
  if(total.level==='fast')return 'Chi đang nhanh hơn thời gian trôi. Nên chậm lại vài ngày.';
  return 'Với nhịp này, ngân sách sẽ cạn trước cuối tháng. Ưu tiên cắt các khoản chưa cần thiết.';
}
function meter(label,ratio,kind){
  return '<div class="hud-meter"><div><span>'+label+'</span><strong>'+percent(ratio)+'</strong></div><div class="hud-track"><i class="'+kind+'" style="width:'+clamp(ratio*100)+'%"></i></div></div>';
}
const tile=(label,value,note)=>'<div class="hud-tile"><span>'+label+'</span><strong>'+value+'</strong><small>'+note+'</small></div>';
function renderHud(data){
  const host=$('#paceHud');if(!host)return;
  const {info,total,limit,spent,rows}=data,remaining=limit-spent;
  const level=limit?total.level:'idle',statusText=limit?LEVELS[level].label:'Chưa có ngân sách';
  const daily=info.left&&limit?ctx.vnd(Math.max(0,remaining)/info.left):'—';
  const forecast=info.state==='current'&&limit?spent/info.elapsed:null;
  const counts=['over','risk','fast','good','slow'].map(key=>{const count=rows.filter(row=>row.level===key).length;return count?chip(key,count+' · '+LEVELS[key].label):''}).join('');
  const monthLabel='Tháng '+data.month.slice(5)+'/'+data.month.slice(0,4);
  host.className='hud lv-'+level;
  host.innerHTML='<div class="hud-gauge">'+gauge(limit?total.index:null,level)+chip(level,statusText)+'</div>'+
    '<div class="hud-body"><div class="hud-eyebrow">Tốc độ chi tiêu · '+monthLabel+(info.state==='current'?' · ngày '+info.passed+'/'+info.days:'')+'</div>'+
    '<p class="hud-message">'+hudMessage(data)+'</p>'+
    meter('Ngân sách đã dùng',total.used,'used')+meter('Thời gian đã qua',info.elapsed,'time')+
    '<div class="hud-tiles">'+
      tile('Đã chi / ngân sách',ctx.vnd(spent),'trên '+ctx.vnd(limit))+
      tile(remaining<0?'Vượt ngân sách':'Còn lại',ctx.vnd(Math.abs(remaining)),rows.length+' danh mục có hạn mức')+
      tile('Có thể chi mỗi ngày',daily,info.left?'còn '+info.left+' ngày'+(info.state==='current'?', tính cả hôm nay':''):'tháng đã kết thúc')+
      tile('Dự báo cuối tháng',forecast===null?'—':ctx.vnd(forecast),forecast===null?'chỉ tính cho tháng hiện tại':forecast>limit?'vượt khoảng '+ctx.vnd(forecast-limit):'trong ngân sách')+
    '</div>'+(counts?'<div class="hud-counts" aria-label="Số danh mục theo trạng thái">'+counts+'</div>':'')+'</div>';
}

/* ---------- Tiến độ theo danh mục ---------- */
function categoryCard(row,info){
  const color=/^#[0-9a-f]{6}$/i.test(row.record?.color||'')?row.record.color:'';
  const icon=row.record?.icon&&row.record.icon!=='•'?row.record.icon:row.name.trim().charAt(0).toUpperCase();
  const remaining=row.limit-row.spent;
  let advice=remaining<0?'Vượt '+ctx.vnd(-remaining):'Còn '+ctx.vnd(remaining);
  if(remaining>0&&info.state==='current')advice+=' · '+ctx.vnd(remaining/info.left)+'/ngày';
  const marker=info.state==='current'?'<b class="pace-marker" style="left:'+clamp(info.elapsed*100)+'%" title="Thời gian đã qua '+percent(info.elapsed)+'"></b>':'';
  return '<article class="pace-card lv-'+row.level+'" data-category="'+esc(row.id)+'">'+
    '<div class="pace-head"><span class="pace-icon"'+(color?' style="border-color:'+color+'"':'')+' aria-hidden="true">'+esc(icon)+'</span>'+
    '<div class="pace-name"><strong>'+esc(row.name)+'</strong><small>'+ctx.vnd(row.spent)+' / '+ctx.vnd(row.limit)+(row.isDefault?' · mặc định':'')+'</small></div>'+
    '<span class="pace-percent">'+percent(row.used)+'</span></div>'+
    '<div class="pace-track" role="progressbar" aria-label="'+esc(row.name)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(clamp(row.used*100))+'"><i style="width:'+clamp(row.used*100)+'%"></i>'+marker+'</div>'+
    '<div class="pace-foot">'+chip(row.level,LEVELS[row.level].label+(row.index===null?'':' · '+indexText(row.index)))+'<span class="pace-advice">'+advice+'</span>'+
    '<span class="pace-actions"><button class="btn" data-budget-edit="'+esc(row.id)+'">Sửa</button><button class="del" data-budget-del="'+esc(row.id)+'" data-budget-scope="'+(row.isDefault?'default':'month')+'" aria-label="Xóa hạn mức '+esc(row.name)+'">×</button></span></div></article>';
}
function renderCategories(data){
  const host=$('#budgetList');if(!host)return;
  const cards=data.rows.length?'<div class="pace-grid">'+data.rows.map(row=>categoryCard(row,data.info)).join('')+'</div>':'<p class="note">Chưa đặt ngân sách cho tháng '+data.month+'. Bấm “Hạn mức tháng” để bắt đầu.</p>';
  const outside=data.outside.length?'<div class="pace-outside"><h4>Đã chi nhưng chưa đặt hạn mức</h4><div>'+data.outside.map(item=>'<button class="btn" data-budget-edit="'+esc(item.id)+'">'+esc(item.name)+' · '+ctx.vnd(item.spent)+' <span aria-hidden="true">＋</span></button>').join('')+'</div></div>':'';
  host.innerHTML=cards+outside;
}

/* ---------- Mục tiêu tiết kiệm ---------- */
function cleanGoals(list){
  const iso=/^\d{4}-\d{2}-\d{2}$/;
  return (Array.isArray(list)?list:[]).filter(goal=>goal&&goal.id&&Number(goal.target)>0&&iso.test(goal.start)&&iso.test(goal.deadline))
    .map(goal=>({...goal,id:String(goal.id),name:String(goal.name||'Mục tiêu'),target:Number(goal.target),source:String(goal.source||'manual'),initial:Number(goal.initial)||0,
      entries:(Array.isArray(goal.entries)?goal.entries:[]).filter(entry=>entry&&entry.id&&Number.isFinite(Number(entry.amount))).map(entry=>({id:String(entry.id),date:String(entry.date||''),amount:Number(entry.amount)}))}));
}
function readGoals(){try{return cleanGoals(JSON.parse(localStorage.getItem(STORE)||'[]'))}catch{return []}}
function writeGoals(list){localStorage.setItem(STORE,JSON.stringify(list));renderSavings()}
function savedAmount(goal,wallets){
  if(goal.source==='manual')return goal.initial+goal.entries.reduce((sum,entry)=>sum+entry.amount,0);
  return wallets.find(wallet=>wallet.id===goal.source)?.balance||0;
}
function goalCard(goal,wallets,all){
  const current=savedAmount(goal,wallets),state=savingPace(goal,current,ctx.today()),manual=goal.source==='manual';
  const wallet=wallets.find(item=>item.id===goal.source),shared=manual?0:all.filter(item=>item.source===goal.source).length;
  const source=manual?'Tự ghi nhận':wallet?'Theo số dư ví '+wallet.name+(shared>1?' (đang dùng cho '+shared+' mục tiêu)':''):'Ví liên kết không còn, hãy sửa mục tiêu';
  let plan;
  if(!state.remaining)plan='Đã đạt mục tiêu';
  else if(state.daysLeft<0)plan='Còn thiếu '+ctx.vnd(state.remaining);
  else{
    const from=goal.start>ctx.today()?goal.start:ctx.today(),days=utcDay(goal.deadline)-utcDay(from)+1;
    plan=days>31?'Cần thêm khoảng '+ctx.vnd(state.remaining/(days/30.4375))+'/tháng':'Cần thêm '+ctx.vnd(state.remaining)+' trước hạn';
  }
  const timeLeft=state.daysLeft<0?'quá '+(-state.daysLeft)+' ngày':state.daysLeft===0?'đến hạn hôm nay':'còn '+state.daysLeft+' ngày';
  const history=manual&&goal.entries.length?'<details class="goal-history" data-history="'+esc(goal.id)+'"'+(openHistory.has(goal.id)?' open':'')+'><summary>Lịch sử góp ('+goal.entries.length+')</summary><ul>'+goal.entries.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(entry=>'<li><span>'+esc(dateText(entry.date))+' · '+(entry.amount<0?'Rút ':'Góp ')+ctx.vnd(Math.abs(entry.amount))+'</span><button class="del" data-entry-del="'+esc(goal.id)+'|'+esc(entry.id)+'" aria-label="Xóa lần ghi nhận">×</button></li>').join('')+'</ul></details>':'';
  return '<article class="saving-card lv-'+state.level+'" data-saving="'+esc(goal.id)+'">'+
    '<div class="saving-head"><div class="saving-ring" style="--p:'+clamp(state.progress*100)+'" aria-hidden="true"><span>'+percent(state.progress)+'</span></div>'+
    '<div class="saving-title"><strong>'+esc(goal.name)+'</strong><div class="saving-money"><b>'+ctx.vnd(current)+'</b> / '+ctx.vnd(goal.target)+'</div><small>'+esc(source)+'</small></div></div>'+
    '<div class="saving-meta">'+chip(state.level,state.label+(state.index===null||!state.remaining||state.daysLeft<0?'':' · '+indexText(state.index)))+'<span>Hạn '+dateText(goal.deadline)+' · '+timeLeft+'</span></div>'+
    '<div class="saving-plan">'+plan+' · thời gian đã qua '+percent(state.elapsed)+'</div>'+history+
    '<div class="saving-actions">'+(manual?'<button class="btn primary" data-goal-add="'+esc(goal.id)+'">Góp / rút</button>':'')+'<button class="btn" data-goal-edit="'+esc(goal.id)+'">Sửa</button><button class="del" data-goal-remove="'+esc(goal.id)+'" aria-label="Xóa mục tiêu '+esc(goal.name)+'">×</button></div></article>';
}
function renderSavings(){
  const host=$('#savingList');if(!host)return;
  const goals=readGoals(),wallets=ctx.wallets();
  host.innerHTML=goals.length?'<div class="saving-grid">'+goals.map(goal=>goalCard(goal,wallets,goals)).join('')+'</div>':'<p class="note">Chưa có mục tiêu tiết kiệm. Tạo mục tiêu với số tiền và hạn hoàn thành để theo dõi nhịp tích lũy.</p>';
}
async function goalForm(id){
  const goals=readGoals(),goal=goals.find(item=>item.id===id),wallets=ctx.wallets(),money=value=>Math.round(ctx.A.parseMoney(value||'0'));
  const nextYear=new Date(ctx.today()+'T12:00:00');nextYear.setFullYear(nextYear.getFullYear()+1);
  const defaultDeadline=nextYear.getFullYear()+'-'+String(nextYear.getMonth()+1).padStart(2,'0')+'-'+String(nextYear.getDate()).padStart(2,'0');
  const options=[{value:'manual',label:'Tự ghi nhận từng lần góp'}].concat(wallets.map(wallet=>({value:wallet.id,label:'Theo số dư ví: '+wallet.name})));
  await ctx.openSheet({title:goal?'Sửa mục tiêu tiết kiệm':'Mục tiêu tiết kiệm mới',fields:[
    {name:'name',label:'Tên mục tiêu',required:true,value:goal?.name||'',placeholder:'VD: Quỹ du lịch'},
    {name:'target',label:'Số tiền mục tiêu (₫)',type:'money',required:true,value:goal?ctx.A.formatCanonicalMoney(goal.target):''},
    {name:'start',label:'Ngày bắt đầu',type:'date',required:true,value:goal?.start||ctx.today()},
    {name:'deadline',label:'Hạn hoàn thành',type:'date',required:true,value:goal?.deadline||defaultDeadline},
    {name:'source',label:'Cách tính số đã tiết kiệm',type:'select',options,value:goal?(options.some(option=>option.value===goal.source)?goal.source:'manual'):'manual'},
    {name:'initial',label:'Số đã có sẵn (₫)',type:'money',value:ctx.A.formatCanonicalMoney(goal?.initial||0)}
  ],render:form=>{
    const select=form.querySelector('#sheet-source'),initial=form.querySelector('#sheet-initial').parentElement;
    const note=document.createElement('p');note.className='note';note.textContent='Mục tiêu chỉ dùng để theo dõi, không tạo giao dịch và không trừ tiền trong ví.';form.append(note);
    const sync=()=>{initial.hidden=select.value!=='manual'};select.addEventListener('change',sync);sync();
  },onSubmit:values=>{
    const name=values.name.trim(),target=money(values.target);
    if(!name){ctx.A.toast('Nhập tên mục tiêu');return false}
    if(target<=0){ctx.A.toast('Số tiền mục tiêu phải lớn hơn 0');return false}
    if(!values.start||!values.deadline||values.deadline<=values.start){ctx.A.toast('Hạn hoàn thành phải sau ngày bắt đầu');return false}
    const next={...(goal||{id:crypto.randomUUID(),entries:[]}),name,target,start:values.start,deadline:values.deadline,source:values.source,initial:money(values.initial)};
    const list=readGoals();writeGoals(goal?list.map(item=>item.id===goal.id?next:item):list.concat(next));ctx.A.toast('Đã lưu mục tiêu');
  }});
}
async function contribute(id){
  const goal=readGoals().find(item=>item.id===id);if(!goal)return;
  await ctx.openSheet({title:'Góp / rút · '+goal.name,fields:[
    {name:'action',label:'Thao tác',type:'select',options:[{value:'add',label:'Góp thêm'},{value:'withdraw',label:'Rút bớt'}]},
    {name:'amount',label:'Số tiền (₫)',type:'money',required:true},
    {name:'date',label:'Ngày',type:'date',required:true,value:ctx.today()}
  ],onSubmit:values=>{
    const amount=Math.round(ctx.A.parseMoney(values.amount||'0'));
    if(amount<=0){ctx.A.toast('Nhập số tiền lớn hơn 0');return false}
    if(values.action==='withdraw'&&amount>savedAmount(goal,[])){ctx.A.toast('Số rút lớn hơn số đã tiết kiệm');return false}
    const entry={id:crypto.randomUUID(),date:values.date,amount:values.action==='withdraw'?-amount:amount};
    writeGoals(readGoals().map(item=>item.id===id?{...item,entries:item.entries.concat(entry)}:item));ctx.A.toast('Đã ghi nhận');
  }});
}
async function savingClick(event){
  const button=event.target.closest('button');if(!button)return;
  const {goalAdd,goalEdit,goalRemove,entryDel}=button.dataset;
  if(goalAdd)return contribute(goalAdd);
  if(goalEdit)return goalForm(goalEdit);
  if(goalRemove){if(await ctx.confirm('Xóa mục tiêu','Bạn có chắc muốn xóa mục tiêu tiết kiệm này?'))writeGoals(readGoals().filter(goal=>goal.id!==goalRemove));return}
  if(entryDel){const [goalId,entryId]=entryDel.split('|');if(await ctx.confirm('Xóa lần ghi nhận','Bạn có chắc muốn xóa lần góp/rút này?'))writeGoals(readGoals().map(goal=>goal.id===goalId?{...goal,entries:goal.entries.filter(entry=>entry.id!==entryId)}:goal))}
}

/* ---------- Khung tab ---------- */
function render(){
  if(!ctx)return;
  const data=budgetSnapshot();
  $('#manageLabel').textContent=data.range.label;
  $('#budgetTitle').textContent='Tiến độ chi tiêu · tháng '+data.month.slice(5)+'/'+data.month.slice(0,4);
  renderHud(data);renderCategories(data);renderSavings();
}
function mount(context){
  ctx=context;
  $('#managePrev').onclick=()=>ctx.shift(-1);
  $('#manageNext').onclick=()=>ctx.shift(1);
  $('#budgetList').onclick=event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.budgetEdit)ctx.editLimit(button.dataset.budgetEdit);
    else if(button.dataset.budgetDel)ctx.deleteLimit(button.dataset.budgetDel,button.dataset.budgetScope);
  };
  $('#savingList').onclick=savingClick;
  $('#savingList').addEventListener('toggle',event=>{const id=event.target.dataset?.history;if(id)event.target.open?openHistory.add(id):openHistory.delete(id)},true);
  $('#addSavingGoal').onclick=()=>goalForm();
  /* Vẽ lại khi mở tab hoặc quay lại app, để tiến độ thời gian luôn đúng ngày */
  $('[data-main-tab="manage"]').addEventListener('click',()=>ctx.refresh());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
}
window.__manage={mount,render,monthInfo,paceOf,savingPace,
  exportData:readGoals,
  importData:list=>localStorage.setItem(STORE,JSON.stringify(cleanGoals(list)))};
})();

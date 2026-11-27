(function(){
const A=window.__sodautu;if(!A)return;
const K={cats:'thu-chi-categories-v1',budgets:'thu-chi-budgets-v1',recurring:'thu-chi-recurring-v1',goals:'so-dau-tu-goals-v1',targets:'so-dau-tu-targets-v1',snaps:'so-dau-tu-snapshots-v1',trades:'so-dau-tu-trades-v1',categoryMeta:'thu-chi-category-meta-v1',pin:'so-dau-tu-pin-v1',dark:'so-dau-tu-dark-v1',hide:'so-dau-tu-hide-balances-v1'};
const read=(k,d)=>{try{const x=JSON.parse(localStorage.getItem(k));return x??d}catch{return d}},write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
backupBeforeLoanMigration();
function backupBeforeUxMigration(){const key='backup-before-mobile-experience';if(localStorage.getItem(key))return;const snapshot={};for(let index=0;index<localStorage.length;index++){const storageKey=localStorage.key(index);snapshot[storageKey]=localStorage.getItem(storageKey)}localStorage.setItem(key,JSON.stringify(snapshot))}
backupBeforeUxMigration();
function backupBeforeReportMigration(){
  const key='backup-before-report-periods';
  if(localStorage.getItem(key))return;
  const snapshot={};
  for(let index=0;index<localStorage.length;index++){
    const storageKey=localStorage.key(index);
    snapshot[storageKey]=localStorage.getItem(storageKey);
  }
  localStorage.setItem(key,JSON.stringify(snapshot));
}
backupBeforeReportMigration();
let cat=read(K.cats,{income:['Lương','Thưởng','Kinh doanh/làm thêm','Lãi tiết kiệm','Cổ tức','Khác'],expense:['Ăn uống','Tiền nhà','Nhà ở','Đi lại','Hóa đơn điện, nước, phí dịch vụ','Hóa đơn (điện, nước, net)','Góp quỹ','Mua sắm','Sức khỏe','Giáo dục','Giải trí','Quà tặng/hiếu hỉ','Trả nợ','Khác']});let categoriesChanged=false;const oldLoanCategory='Hóa đơn điện, nước, phí dịch vụ',loanCategory='Cho vay',oldLoanIndex=cat.expense.indexOf(oldLoanCategory);if(oldLoanIndex>=0){cat.expense.splice(oldLoanIndex,1);if(!cat.expense.includes(loanCategory))cat.expense.splice(oldLoanIndex,0,loanCategory);categoriesChanged=true}const expenseDefaults=['Tiền nhà','Cho vay','Góp quỹ'];expenseDefaults.forEach(c=>{if(!cat.expense.includes(c)){cat.expense.push(c);categoriesChanged=true}});const loanRepaymentIncome='Nhận hoàn trả tiền cho vay';if(!cat.income.includes(loanRepaymentIncome)){cat.income.push(loanRepaymentIncome);categoriesChanged=true}if(categoriesChanged)write(K.cats,cat);
let categoryMeta=read(K.categoryMeta,{}),budgets=read(K.budgets,{}),recurring=read(K.recurring,[]),goals=read(K.goals,[]),targets=read(K.targets,{}),snaps=read(K.snaps,[]),trades=read(K.trades,[]);
const LOAN_KEY='so-dau-tu-loans-v1';
let loans=read(LOAN_KEY,[]);
if(!Array.isArray(loans))loans=[];
const CATEGORY_KEY='thu-chi-category-records-v1';
let categoryRecords=read(CATEGORY_KEY,[]);if(!Array.isArray(categoryRecords))categoryRecords=[];
const categorySlug=(type,name)=>type+'-'+String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const categoryMap=new Map(categoryRecords.map(record=>[record.id,record]));
const categoryByName=(type,name)=>categoryRecords.find(record=>record.type===type&&record.name===name);
function ensureCategory(type,name){let record=categoryByName(type,name);if(!record){const id=categorySlug(type,name);record=categoryMap.get(id)||{id,name,type,icon:categoryMeta[name]?.icon||'',color:categoryMeta[name]?.color||'',hidden:false};record.name=name;record.type=type;record.hidden=!!record.hidden;categoryMap.set(id,record);categoryRecords=Array.from(categoryMap.values())}return record}
function categoryType(transaction){return transaction.type==='income'?'income':'expense'}
function migrateReportCategories(){
  if(localStorage.getItem('so-dau-tu-report-categories-v1')==='done')return;
  const transactions=A.getTransactions();
  ['income','expense'].forEach(type=>cat[type].forEach(name=>ensureCategory(type,name==='Nhà ở'?'Tiền nhà':name)));
  const mergedBudget={};
  Object.entries(budgets).forEach(([month,limits])=>{
    const next={};
    Object.entries(limits||{}).forEach(([key,amount])=>{const oldRecord=categoryRecords.find(record=>record.id===key),name=oldRecord?.name||key,target=name==='Nhà ở'?'Tiền nhà':name,record=ensureCategory('expense',target);next[record.id]=(Number(next[record.id])||0)+(Number(amount)||0)});
    mergedBudget[month]=next;
  });
  const mergedDefaults={};
  const oldDefaults=read('thu-chi-default-budgets-v1',{});
  Object.entries(oldDefaults).forEach(([key,amount])=>{const oldRecord=categoryRecords.find(record=>record.id===key),name=oldRecord?.name||key,record=ensureCategory('expense',name==='Nhà ở'?'Tiền nhà':name);mergedDefaults[record.id]=(Number(mergedDefaults[record.id])||0)+(Number(amount)||0)});
  transactions.forEach(transaction=>{
    if(!transaction.category)return;
    const type=categoryType(transaction),oldRecord=categoryRecords.find(record=>record.id===transaction.categoryId),name=oldRecord?.name||transaction.category,target=name==='Nhà ở'?'Tiền nhà':name;
    const record=ensureCategory(type,target);transaction.categoryId=record.id;transaction.category=record.name;
  });
  ['income','expense'].forEach(type=>{cat[type]=Array.from(new Set((cat[type]||[]).map(name=>name==='Nhà ở'?'Tiền nhà':name)))});
  const legacyHousing=categoryRecords.find(record=>record.type==='expense'&&record.name==='Nhà ở');
  const rentCategory=categoryRecords.find(record=>record.type==='expense'&&record.name==='Tiền nhà');
  if(legacyHousing){legacyHousing.hidden=true;if(rentCategory){rentCategory.icon=rentCategory.icon||legacyHousing.icon||categoryMeta['Nhà ở']?.icon||'';rentCategory.color=rentCategory.color||legacyHousing.color||categoryMeta['Nhà ở']?.color||''}} 
  recurring=recurring.map(item=>{if(!item.category)return item;const type=item.type==='income'?'income':'expense',oldRecord=categoryRecords.find(record=>record.id===item.categoryId),name=oldRecord?.name||item.category,record=ensureCategory(type,name==='Nhà ở'?'Tiền nhà':name);return {...item,categoryId:record.id,category:record.name}});
  write(K.cats,cat);write(K.budgets,mergedBudget);write('thu-chi-default-budgets-v1',mergedDefaults);write(K.recurring,recurring);write(CATEGORY_KEY,categoryRecords);A.setTransactions(transactions);
  localStorage.setItem('so-dau-tu-report-categories-v1','done');
}
migrateReportCategories();
if(oldLoanIndex>=0&&categoryMeta[oldLoanCategory]){if(!categoryMeta[loanCategory])categoryMeta[loanCategory]=categoryMeta[oldLoanCategory];delete categoryMeta[oldLoanCategory];write(K.categoryMeta,categoryMeta)}
const $=selector=>document.querySelector(selector);
const today=()=>{const date=new Date();return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')};
const period=()=>A.getMonth?A.getMonth():A.getWeek?A.getWeek(today()):today();
const vnd=amount=>document.documentElement.classList.contains('hide-balances')?'••••':A.fmt(amount);
const types={gold:'Vàng',stock:'Cổ phiếu',saving:'Tiết kiệm',cash:'Tiền mặt',bank:'Ngân hàng',ewallet:'Ví điện tử',debt:'Nợ'};
const reportStorageKey='so-dau-tu-report-period-v1';
const dateKey=date=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
const initialReport=read(reportStorageKey,null);
let reportState=initialReport&&['week','month'].includes(initialReport.mode)&&/^\d{4}-\d{2}-\d{2}$/.test(initialReport.anchor)?initialReport:{mode:'month',anchor:today().slice(0,7)+'-01'};
function startOfWeek(date){const start=new Date(date.getFullYear(),date.getMonth(),date.getDate());start.setDate(start.getDate()-((start.getDay()+6)%7));return start}
function reportRange(){const anchor=new Date(reportState.anchor+'T12:00:00');if(reportState.mode==='month'){const start=new Date(anchor.getFullYear(),anchor.getMonth(),1),end=new Date(anchor.getFullYear(),anchor.getMonth()+1,0);return {start:dateKey(start),end:dateKey(end),mode:'month',month:dateKey(start).slice(0,7),label:'Tháng '+String(start.getMonth()+1).padStart(2,'0')+'/'+start.getFullYear()}}const start=startOfWeek(anchor),end=new Date(start);end.setDate(end.getDate()+6);const key=A.getWeek(dateKey(start)),week=Number(key.slice(-2)),format=date=>new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit'}).format(date);return {start:dateKey(start),end:dateKey(end),mode:'week',month:dateKey(start).slice(0,7),label:'Tuần '+week+' · '+format(start)+' – '+format(end)}}
function saveReport(){localStorage.setItem(reportStorageKey,JSON.stringify(reportState))}
function shiftReport(delta){const date=new Date(reportState.anchor+'T12:00:00');if(reportState.mode==='week')date.setDate(date.getDate()+delta*7);else date.setMonth(date.getMonth()+delta);reportState.anchor=dateKey(date);saveReport();renderAll()}
function setReportMode(mode){if(!['week','month'].includes(mode))return;const range=reportRange(),anchor=new Date((mode==='week'?range.start:range.month+'-01')+'T12:00:00');reportState={mode,anchor:dateKey(anchor)};saveReport();renderAll()}
function reportToday(){const date=new Date();reportState={mode:reportState.mode,anchor:reportState.mode==='week'?dateKey(startOfWeek(date)):dateKey(new Date(date.getFullYear(),date.getMonth(),1))};saveReport();renderAll()}
window.__reportPeriod={range:reportRange,get:()=>({...reportState}),previous:()=>shiftReport(-1),next:()=>shiftReport(1),today:reportToday,setMode:setReportMode,month:()=>reportRange().month};
function displayCategory(transaction){return categoryRecords.find(record=>record.id===transaction.categoryId)?.name||transaction.category||'Khác'}
window.__categoryAPI={nameFor:displayCategory,idForTransaction:transaction=>categoryRecords.find(record=>record.id===transaction.categoryId)?.id||ensureCategory(categoryType(transaction),transaction.category||'Khác').id,records:()=>categoryRecords.slice()};
function investmentValuation(item){const cost=item.type==='gold'?A.num(item.price)*A.num(item.qty)+A.num(item.fee):A.num(item.price)*A.num(item.qty);if(localStorage.getItem('so-dau-tu-valuation-mode')!=='market'||!['gold','stock'].includes(item.type))return cost;const current=A.num(item.currentPrice);return current?current*A.num(item.qty):cost}
window.__assetValuation={value:investmentValuation,mode:()=>localStorage.getItem('so-dau-tu-valuation-mode')||'cost'};
function openSheet({title,fields=[],submit='Lưu',cancel='Hủy',onSubmit,render}){
  return new Promise(resolve=>{
    const modal=$('#uiModal'),body=$('#uiModalBody'),actions=$('#uiModalActions');
    $('#uiModalTitle').textContent=title;body.innerHTML='';actions.innerHTML='';
    const form=document.createElement('form');form.className='sheet-form';form.id='sheet-form';
    fields.forEach(field=>{
      const wrapper=document.createElement('div');wrapper.className='field '+(field.full?'full':'');
      const id='sheet-'+field.name;const label=document.createElement('label');label.htmlFor=id;label.textContent=field.label;wrapper.append(label);
      let input;
      if(field.type==='select'){
        input=document.createElement('select');
        (field.options||[]).forEach(option=>{const node=document.createElement('option');node.value=option.value;node.textContent=option.label;input.append(node)});
      }else if(field.type==='textarea')input=document.createElement('textarea');
      else{input=document.createElement('input');input.type=field.type||'text';if(field.type==='money'||field.type==='number'){input.type='text';input.inputMode='decimal';}}
      input.id=id;input.name=field.name;input.value=field.value??(field.type==='select'?field.options?.[0]?.value:'')??'';if(field.placeholder)input.placeholder=field.placeholder;
      if(field.type==='money')input.dataset.money='true';if(field.type==='number')input.dataset.number='true';if(field.required)input.required=true;
      wrapper.append(input);form.append(wrapper);
    });
    if(render)render(form);
    const cancelButton=document.createElement('button');cancelButton.type='button';cancelButton.className='btn';cancelButton.textContent=cancel;
    const submitButton=document.createElement('button');submitButton.type='submit';submitButton.setAttribute('form','sheet-form');submitButton.className='btn primary';submitButton.textContent=submit;
    actions.append(cancelButton,submitButton);modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    const close=value=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');body.innerHTML='';resolve(value)};
    $('#uiModalClose').onclick=()=>close(null);cancelButton.onclick=()=>close(null);
    modal.onclick=event=>{if(event.target===modal)close(null)};
    form.onsubmit=async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(form).entries());if(onSubmit){const result=await onSubmit(values);if(result===false)return}close(values)};
    body.append(form);form.querySelector('input,select,textarea')?.focus();
  });
}
async function confirmSheet(title,message,confirmLabel='Xóa'){
  let accepted=false;
  await openSheet({title,submit:confirmLabel,onSubmit:()=>{accepted=true},render:body=>{const text=document.createElement('p');text.className='note';text.textContent=message;body.append(text)}});
  return accepted;
}
window.__ui={openSheet,confirmAction:confirmSheet,toast:A.toast};
function formatMoneyField(value){return A.formatCanonicalMoney(Math.round(A.parseMoney(value||'0')))}

const monthPeriod=()=>reportRange().month;
const tx=()=>A.getTransactions(), assets=()=>A.getItems(), saveTx=x=>A.setTransactions(x), saveAssets=x=>A.setItems(x);
function val(x){if(['gold','stock'].includes(x.type)&&window.__assetValuation)return window.__assetValuation.value(x);if(x.type==='gold')return A.num(x.price)*A.num(x.qty)+A.num(x.fee);if(x.type==='stock')return A.num(x.price)*A.num(x.qty);if(x.type==='debt'&&window.__ledgerAPI)return window.__ledgerAPI.debtBalance(x);if(WALLET_TYPES.includes(x.type)&&window.__ledgerAPI)return window.__ledgerAPI.walletBalance(x);return A.num(x.amount)}
const LEDGER_KEY='so-dau-tu-ledger-v1';
const WALLET_TYPES=['cash','bank','ewallet','saving'];
const money=value=>Math.round(A.parseMoney(value));
const signedMoney=value=>String(value??'').trim().startsWith('-')?-money(String(value).trim().slice(1)):money(value);
const storedMoney=value=>{const number=Number(value);return Number.isFinite(number)?Math.round(number):0};
function walletIdFor(item){return 'asset:'+item.id}
function walletTypeName(type){return ({cash:'Tiền mặt',bank:'Ngân hàng',ewallet:'Ví điện tử',saving:'Sổ tiết kiệm'})[type]||'Ví'}
function walletForId(id){return assets().find(item=>walletIdFor(item)===id&&WALLET_TYPES.includes(item.type))}
function transactionDeltas(t){
  const deltas={};
  const add=(id,amount)=>{if(id)deltas[id]=(deltas[id]||0)+amount};
  const amount=t.kind==='adjust'?storedMoney(t.amount):money(t.amount);
  if(t.kind==='adjust')add(t.walletId,amount);
  else if(t.kind==='invest')add(t.walletId,-amount);
  else if(t.kind==='trade')add(t.walletId,t.side==='sell'?amount:-amount);
  else if(t.type==='income')add(t.walletId,amount);
  else if(t.type==='expense')add(t.walletId,-amount);
  else if(t.type==='transfer'){
    add(t.fromWallet,-amount);
    add(t.toWallet,amount);
  }
  return deltas;
}
function walletBalance(wallet, list=tx()){
  let balance=storedMoney(wallet.openingBalance??wallet.amount);
  list.forEach(t=>{balance+=transactionDeltas(t)[walletIdFor(wallet)]||0});
  return balance;
}
function debtBalance(debt, list=tx()){
  const paid=list.filter(t=>t.type==='expense'&&t.category==='Trả nợ'&&t.debtId===debt.id)
    .reduce((sum,t)=>sum+money(t.principal??t.amount),0);
  return storedMoney(debt.openingBalance??debt.amount)-paid;
}
function allWallets(includeHidden=false){
  return assets().filter(item=>WALLET_TYPES.includes(item.type)&&(!item.hidden||includeHidden))
    .map(item=>({id:walletIdFor(item),name:item.name||walletTypeName(item.type),assetId:item.id,type:item.type,balance:walletBalance(item)}));
}
function saveLedger(items=assets()){A.setItems(items)}
function migrateLedger(){
  if(localStorage.getItem(LEDGER_KEY)==='ready')return;
  const backupKey='backup-before-ledger-balance';
  if(!localStorage.getItem(backupKey)){
    const snapshot={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      snapshot[key]=localStorage.getItem(key);
    }
    localStorage.setItem(backupKey,JSON.stringify(snapshot));
  }
  const list=assets(),ledgerTx=tx();
  list.forEach(item=>{
    if(WALLET_TYPES.includes(item.type)&&item.openingBalance===undefined){
      const impacts=ledgerTx.reduce((sum,t)=>sum+(transactionDeltas(t)[walletIdFor(item)]||0),0);
      item.openingBalance=money(item.amount)-impacts;
    }
    if(item.type==='debt'&&item.openingBalance===undefined){
      const paid=ledgerTx.filter(t=>t.type==='expense'&&t.category==='Trả nợ'&&t.debtId===item.id)
        .reduce((sum,t)=>sum+money(t.principal??t.amount),0);
      item.openingBalance=money(item.amount)+paid;
    }
  });
  const known=new Set(list.filter(item=>WALLET_TYPES.includes(item.type)).map(walletIdFor));
  const orphanIds=new Set();
  ledgerTx.forEach(t=>{
    ['walletId','fromWallet','toWallet'].forEach(key=>{
      if(t[key]&&!known.has(t[key]))orphanIds.add(t[key]);
    });
  });
  if(orphanIds.size){
    const orphan={id:crypto.randomUUID(),name:'Ví chưa xác định',type:'cash',openingBalance:0,amount:0};
    list.push(orphan);
    const orphanId=walletIdFor(orphan);
    ledgerTx.forEach(t=>['walletId','fromWallet','toWallet'].forEach(key=>{
      if(t[key]&&!known.has(t[key]))t[key]=orphanId;
    }));
    saveTx(ledgerTx);
    localStorage.setItem('so-dau-tu-ledger-orphans',String(orphanIds.size));
  }
  if(!list.some(item=>WALLET_TYPES.includes(item.type))){
    list.push({id:crypto.randomUUID(),name:'Ví tiền mặt',type:'cash',openingBalance:0,amount:0});
  }
  A.setItems(list);
  localStorage.setItem(LEDGER_KEY,'ready');
}
function walletSelect(id,selected,label){
  const wallets=allWallets(),blank=id==='txWallet'?'Chọn tài khoản thu/chi':'Chọn tài khoản nhận';
  return '<div class="field tx-wallet"><label for="'+id+'">'+label+'</label><select id="'+id+'"><option value="">'+blank+'</option>'+wallets.map(wallet=>'<option value="'+A.esc(wallet.id)+'" '+(wallet.id===selected?'selected':'')+'>'+A.esc(wallet.name)+' · '+vnd(wallet.balance)+'</option>').join('')+'</select></div>';
}
function applyTx(){/* Balances are derived from the transaction ledger. */}
function moveInvestmentPanels(){let home=$('#investmentExtras');if(!home){home=document.createElement('div');home.id='investmentExtras';home.className='investment-extra-grid';$('#investmentView').append(home)}if(home.dataset.moved==='1')return;const trade=$('#goldTradeList')?.closest('.advanced-panel'),snapshot=$('#snapshotChart')?.closest('.advanced-panel'),maturity=$('#maturityList')?.closest('.advanced-panel'),goal=$('#goalList')?.closest('.advanced-panel'),target=$('#targetList')?.closest('.advanced-panel');if(goal&&target){const targetHead=target.querySelector('.panel-head'),targetList=$('#targetList'),wrap=document.createElement('div');wrap.className='target-embedded';if(targetHead)wrap.append(targetHead);wrap.append(targetList);goal.append(wrap);target.remove()}[trade,snapshot,goal,maturity].filter(Boolean).forEach(panel=>home.append(panel));home.dataset.moved='1'}function injectCashflowPanels(){const c=$('#cashflowView');if(!c||$('#advancedFinance'))return;c.insertAdjacentHTML('beforeend','<section class=\"advanced-panel\" id=\"walletPanel\" hidden></section><div class=\"advanced-grid\" id=\"advancedFinance\"><section class=\"advanced-panel\"><div class=\"panel-head\"><h3 id=\"budgetTitle\">Ngân sách</h3><div class=\"toolbar\"><button class=\"btn\" id=\"setBudget\">＋ Hạn mức tháng</button><button class=\"btn\" id=\"copyPreviousBudget\">Sao chép tháng trước</button></div></div><div id=\"budgetList\"></div></section><section class=\"advanced-panel wide\"><div class=\"panel-head\"><h3>Giao dịch định kỳ</h3><button class=\"btn\" id=\"addRecurring\">＋ Thêm</button></div><div id=\"recurringDue\"></div><div id=\"recurringList\"></div></section><section class=\"advanced-panel\"><h3 id="donutTitle">Chi tiêu theo danh mục</h3><div id=\"donutChart\" class=\"donut-wrap\"></div></section><section class=\"advanced-panel wide\"><div class=\"panel-head\"><h3>Thu và chi · 6 tháng</h3><span class=\"small\">Cột xanh: thu · đỏ: chi</span></div><div id=\"barChart\" class=\"bar-chart\"></div></section><section class=\"advanced-panel\"><h3 id="cumulativeTitle">Số dư cộng dồn</h3><div id=\"cumulativeChart\" class=\"chart-box\"></div></section><section class=\"advanced-panel\"><h3>Sức khỏe tài chính</h3><div id=\"healthMetrics\" class=\"metric-list\"></div></section><section class=\"advanced-panel\"><h3>Sổ tiết kiệm sắp đáo hạn</h3><div id=\"maturityList\"></div></section><section class=\"advanced-panel\"><div class=\"panel-head\"><h3>Mục tiêu tài chính</h3><button class=\"btn\" id=\"addGoal\">＋ Mục tiêu</button></div><div id=\"goalList\"></div></section><section class=\"advanced-panel\"><div class=\"panel-head\"><h3>Mục tiêu phân bổ</h3><button class=\"btn\" id=\"setTargets\">Chỉnh tỷ trọng</button></div><div id=\"targetList\"></div></section><section class=\"advanced-panel wide\"><div class=\"panel-head\"><h3>Lịch sử mua/bán</h3><button class=\"btn\" id=\"newTrade\">＋ Ghi mua/bán</button></div><div class=\"history-pair\"><div class=\"history-type\"><h4>Vàng</h4><div class=\"table-wrap\"><table><thead><tr><th>Ngày</th><th>Khoản vàng</th><th>Loại</th><th class=\"num\">Khối lượng</th><th class=\"num\">Giá/lượng</th><th class=\"num\">Tổng tiền</th><th class=\"num\">Lãi/lỗ</th></tr></thead><tbody id=\"goldTradeList\"></tbody></table></div></div><div class=\"history-type\"><h4>Cổ phiếu</h4><div class=\"table-wrap\"><table><thead><tr><th>Ngày</th><th>Mã / tên</th><th>Loại</th><th class=\"num\">Số lượng</th><th class=\"num\">Giá/CP</th><th class=\"num\">Tổng tiền</th><th class=\"num\">Lãi/lỗ</th></tr></thead><tbody id=\"stockTradeList\"></tbody></table></div></div></div><div id=\"pnlList\" class=\"metric-list\"></div></section><section class=\"advanced-panel wide\"><div class=\"panel-head\"><h3>Tăng trưởng tổng tài sản</h3><button class=\"btn\" id=\"snapshotNow\">Cập nhật ảnh tháng này</button></div><div id=\"snapshotChart\" class=\"chart-box\"></div></section></div>');
moveInvestmentPanels();$('#setBudget').onclick=setBudget;$('#copyPreviousBudget').onclick=copyPreviousBudget;$('#addRecurring').onclick=()=>addRecurring();$('#addGoal').onclick=addGoal;$('#setTargets').onclick=setTargets;$('#newTrade').onclick=tradeForm;$('#snapshotNow').onclick=saveSnapshot;
}
function txForMonth(key){return tx().filter(t=>(t.date||'').slice(0,7)===key)}function effectiveBudgets(month){return {...defaultBudgets,...(budgets[month]||{})}}
function spendingForMonth(month){const spending={};txForMonth(month).filter(transaction=>transaction.type==='expense'&&transaction.category!=='Cho vay').forEach(transaction=>{const id=window.__categoryAPI.idForTransaction(transaction),amount=cashflowAmount(transaction,'expense');if(amount)spending[id]=(spending[id]||0)+amount});return spending}
let defaultBudgets=read('thu-chi-default-budgets-v1',{});
function renderBudgets(){
  const range=reportRange(),month=range.month,spending=spendingForMonth(month);
  const entries=Object.entries(effectiveBudgets(month)).filter(([id])=>categoryRecords.find(record=>record.id===id)?.name!=='Cho vay');
  const note=range.mode==='week'?'<p class="note">Ngân sách theo tháng '+month+' (tháng chứa ngày đầu tuần).</p>':'';
  $('#budgetList').innerHTML=note+(entries.length?entries.map(([id,limit])=>{
    const category=categoryRecords.find(record=>record.id===id),name=category?.name||'Danh mục đã ẩn';
    const used=spending[id]||0,isDefault=budgets[month]?.[id]===undefined;
    const percent=Number(limit)?used/Number(limit)*100:0,state=percent>=100?'over':percent>=80?'warn':'';
    return '<div class="budget-row"><div class="budget-head"><span>'+A.esc(name)+(isDefault?' · mặc định':'')+'</span><span>'+vnd(used)+' / '+vnd(limit)+' <button class="del" data-budget-del="'+A.esc(id)+'" data-budget-scope="'+(isDefault?'default':'month')+'">×</button></span></div><div class="budget-track"><div class="budget-fill '+state+'" style="width:'+Math.min(100,percent)+'%"></div></div></div>';
  }).join(''):'<p class="note">Chưa đặt ngân sách cho tháng '+month+'.</p>');
  $('#budgetList').onclick=async event=>{
    const button=event.target.closest('[data-budget-del]');if(!button)return;
    const id=button.dataset.budgetDel;
    if(!await confirmSheet('Xóa hạn mức','Bạn có chắc muốn xóa hạn mức này?'))return;
    if(button.dataset.budgetScope==='default'){delete defaultBudgets[id];write('thu-chi-default-budgets-v1',defaultBudgets)}
    else{delete budgets[month]?.[id];write(K.budgets,budgets)}renderBudgets();
  };
}
async function chooseBudgetCategory(){
  const candidates=categoryRecords.filter(record=>record.type==='expense'&&!record.hidden&&record.name!=='Cho vay');
  const options=candidates.map(record=>({value:record.id,label:record.name}));
  const result=await openSheet({title:'Chọn danh mục',fields:[{name:'category',label:'Danh mục',type:'select',options}]});
  return result?candidates.find(record=>record.id===result.category):null;
}
async function setBudget(){
  const category=await chooseBudgetCategory();if(!category)return;
  const result=await openSheet({title:'Hạn mức tháng '+reportRange().month,fields:[{name:'limit',label:'Số tiền (₫)',type:'money',required:true}]});
  if(!result)return;const limit=money(result.limit);if(limit<=0)return;
  const month=reportRange().month;budgets[month]=budgets[month]||{};budgets[month][category.id]=limit;write(K.budgets,budgets);renderBudgets();
}
async function setDefaultBudget(){
  const category=await chooseBudgetCategory();if(!category)return;
  const result=await openSheet({title:'Ngân sách mặc định',fields:[{name:'limit',label:'Số tiền mỗi tháng (₫)',type:'money',required:true}]});
  if(!result)return;const limit=money(result.limit);if(limit<=0)return;
  defaultBudgets[category.id]=limit;write('thu-chi-default-budgets-v1',defaultBudgets);renderBudgets();
}
async function copyPreviousBudget(){
  const month=reportRange().month,date=new Date(month+'-01T12:00:00');date.setMonth(date.getMonth()-1);
  const previous=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');
  if(!budgets[previous]||!Object.keys(budgets[previous]).length){A.toast('Tháng trước chưa có hạn mức riêng để sao chép');return}
  if(!await confirmSheet('Sao chép ngân sách','Sao chép hạn mức riêng từ '+previous+' sang '+month+'?','Sao chép'))return;
  budgets[month]={...budgets[previous]};write(K.budgets,budgets);renderBudgets();
}
function chartExpenses(){const range=reportRange(),spending={};tx().filter(transaction=>transaction.type==='expense'&&(transaction.date||'')>=range.start&&(transaction.date||'')<=range.end).forEach(transaction=>{const amount=cashflowAmount(transaction,'expense'),id=window.__categoryAPI.idForTransaction(transaction);if(amount)spending[id]=(spending[id]||0)+amount});const entries=Object.entries(spending).sort((a,b)=>b[1]-a[1]),total=entries.reduce((sum,item)=>sum+item[1],0),palette=['#1c694b','#c3913d','#6285a1','#a66b86','#72a598','#db775c','#9692bd','#a5aa55','#c37f49'],colors=entries.map((entry,index)=>{const record=categoryRecords.find(item=>item.id===entry[0]);return /^#[0-9a-f]{6}$/i.test(record?.color||'')?record.color:palette[index%palette.length]});let angle=0;const slices=entries.map((entry,index)=>{const end=angle+(total?entry[1]/total*100:0),slice=colors[index]+' '+angle+'% '+end+'%';angle=end;return slice});$('#donutChart').innerHTML=total?'<div class="donut" style="background:conic-gradient('+slices.join(',')+')"></div><div class="legend">'+entries.map((entry,index)=>{const record=categoryRecords.find(item=>item.id===entry[0]);return '<span><i class="dot" style="background:'+colors[index]+'"></i>'+A.esc((record?.icon||'')+' '+(record?.name||'Khác'))+' · '+vnd(entry[1])+' · '+(entry[1]/total*100).toFixed(1)+'%</span>'}).join('')+'</div>':'<p class="note">Chưa có khoản chi trong kỳ này.</p>'}
function renderBars(){const month=reportRange().month,parts=month.split('-').map(Number),end=new Date(parts[0],parts[1]-1,1),months=[];for(let offset=5;offset>=0;offset--){const date=new Date(end.getFullYear(),end.getMonth()-offset,1),key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0'),list=txForMonth(key);months.push({label:String(date.getMonth()+1).padStart(2,'0')+'/'+String(date.getFullYear()).slice(-2),income:list.filter(t=>t.type==='income').reduce((sum,t)=>sum+cashflowAmount(t,'income'),0),expense:list.filter(t=>t.type==='expense').reduce((sum,t)=>sum+cashflowAmount(t,'expense'),0)})}if(months.every(item=>item.income===0&&item.expense===0)){$('#barChart').innerHTML='<p class=\"note\">Chưa có giao dịch thu chi trong sáu tháng kết thúc ở '+reportRange().month+'.</p>';return}const max=Math.max(1,...months.flatMap(item=>[item.income,item.expense]));$('#barChart').innerHTML=months.map(item=>'<div class="bar-month"><div class="bar" title="Thu '+vnd(item.income)+'" style="height:'+(item.income?Math.max(2,item.income/max*100):0)+'%"></div><div class="bar out" title="Chi '+vnd(item.expense)+'" style="height:'+(item.expense?Math.max(2,item.expense/max*100):0)+'%"></div><span class="bar-label">'+item.label+'</span></div>').join('')}
function renderCumulative(){const range=reportRange(),list=tx().filter(t=>(t.date||'')>=range.start&&(t.date||'')<=range.end&&(t.type==='income'||t.type==='expense')).sort((a,b)=>(a.date||'').localeCompare(b.date||''));if(!list.length){$('#cumulativeChart').innerHTML='<p class="note">Chưa có thu chi trong kỳ này.</p>';return}let running=0;const points=[];list.forEach((transaction,index)=>{const amount=cashflowAmount(transaction,transaction.type);running+=(transaction.type==='income'?1:-1)*amount;points.push({x:index/Math.max(1,list.length-1)*100,y:running})});const low=Math.min(0,...points.map(point=>point.y)),high=Math.max(1,...points.map(point=>point.y)),polyline=points.map(point=>(point.x*4)+','+(180-(point.y-low)/(high-low)*160)).join(' ');$('#cumulativeChart').innerHTML='<svg viewBox="0 0 400 200" width="100%" height="200"><polyline points="'+polyline+'" fill="none" stroke="#1c694b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="8" y="18" fill="currentColor" font-size="11">Cuối kỳ: '+A.esc(vnd(running))+'</text></svg>'}
function renderHealth(){const currentMonth=today().slice(0,7),monthDate=new Date(currentMonth+'-01T12:00:00');monthDate.setMonth(monthDate.getMonth()-1);const completed=[];for(let offset=0;offset<6;offset++){const date=new Date(monthDate.getFullYear(),monthDate.getMonth()-offset,1),key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');completed.push(key)}const expenseTotals=completed.map(month=>txForMonth(month).filter(t=>t.type==='expense').reduce((sum,t)=>sum+cashflowAmount(t,'expense'),0)),averageExpense=expenseTotals.length?expenseTotals.reduce((sum,value)=>sum+value,0)/expenseTotals.length:0;const available=allWallets(true).filter(wallet=>wallet.type!=='saving').reduce((sum,wallet)=>sum+wallet.balance,0),savings=allWallets(true).filter(wallet=>wallet.type==='saving').reduce((sum,wallet)=>sum+wallet.balance,0),allAssets=assets(),totalAssets=allAssets.filter(item=>item.type!=='debt').reduce((sum,item)=>sum+val(item),0)+loanTotalOutstanding(),debt=allAssets.filter(item=>item.type==='debt').reduce((sum,item)=>sum+debtBalance(item),0),lastThree=completed.slice(0,3).reverse().map(month=>{const list=txForMonth(month),income=list.filter(t=>t.type==='income').reduce((sum,t)=>sum+cashflowAmount(t,'income'),0),expense=list.filter(t=>t.type==='expense').reduce((sum,t)=>sum+cashflowAmount(t,'expense'),0);return income?(income-expense)/income*100:null}).filter(value=>value!==null),savingAverage=lastThree.length?lastThree.reduce((sum,value)=>sum+value,0)/lastThree.length:null,range=reportRange(),periodTx=tx().filter(t=>(t.date||'')>=range.start&&(t.date||'')<=range.end),invested=periodTx.filter(t=>t.kind==='invest').reduce((sum,t)=>sum+money(t.amount),0),income=periodTx.filter(t=>t.type==='income').reduce((sum,t)=>sum+cashflowAmount(t,'income'),0);$('#healthMetrics').innerHTML='<div class="metric"><span>Quỹ khẩn cấp · chi tiêu TB tháng đã kết thúc</span><strong>'+(averageExpense?((available+savings)/averageExpense).toFixed(1)+' tháng':'—')+'</strong></div><div class="metric"><span>Nợ / tổng tài sản</span><strong>'+(totalAssets?(debt/totalAssets*100).toFixed(1)+'%':'—')+'</strong></div><div class="metric"><span>Tỷ lệ tiết kiệm TB 3 tháng đã kết thúc</span><strong>'+(savingAverage===null?'—':savingAverage.toFixed(1)+'%')+'</strong></div><div class="metric"><span>Đã đầu tư trong kỳ / thu trong kỳ</span><strong>'+(income?(invested/income*100).toFixed(1)+'%':'—')+'</strong></div>'}
function renderGoals(){const it=assets(),total=it.filter(x=>x.type!=='debt').reduce((s,x)=>s+val(x),0)+loanTotalOutstanding();$('#goalList').innerHTML=goals.length?goals.map((g,i)=>{const cur=g.asset==='all'?total:g.asset==='cash'?it.filter(x=>['cash','bank','ewallet'].includes(x.type)).reduce((s,x)=>s+val(x),0)+loanTotalOutstanding():it.filter(x=>x.type===g.asset).reduce((s,x)=>s+val(x),0),p=g.target?Math.min(100,cur/g.target*100):0;return '<div class=\"goal-row\"><div class=\"budget-head\"><span>'+A.esc(g.name)+' <button class=\"del\" data-goal-del=\"'+i+'\">×</button></span><span>'+vnd(cur)+' / '+vnd(g.target)+'</span></div><div class=\"budget-track\"><div class=\"budget-fill\" style=\"width:'+p+'%\"></div></div></div>'}).join(''):'<p class=\"note\">Thêm mục tiêu để theo dõi tiến độ tài chính.</p>';$('#goalList').onclick=async e=>{const i=e.target.closest('[data-goal-del]')?.dataset.goalDel;if(i!==undefined){if(!await confirmSheet('Xóa mục tiêu','Bạn có chắc muốn xóa mục tiêu này?'))return;goals.splice(Number(i),1);write(K.goals,goals);renderGoals()}}}
async function addGoal(){
  const result=await openSheet({title:'Mục tiêu tài chính',fields:[
    {name:'name',label:'Tên mục tiêu',required:true},
    {name:'target',label:'Số tiền mục tiêu (₫)',type:'money',required:true},
    {name:'asset',label:'Nhóm tài sản',type:'select',options:[{value:'all',label:'Toàn bộ tài sản'},{value:'cash',label:'Khả dụng và cho vay'},{value:'gold',label:'Vàng'},{value:'stock',label:'Cổ phiếu'},{value:'saving',label:'Tiết kiệm'}]}
  ]});
  if(!result)return;const target=money(result.target);if(target<=0)return;
  goals.push({name:result.name.trim(),target,asset:result.asset});write(K.goals,goals);renderGoals();
}
function renderTargets(){
  const entries=assets().filter(item=>item.type!=='debt');
  const total=entries.reduce((sum,item)=>sum+val(item),0)+loanTotalOutstanding();
  const actualValue=type=>type==='cash'
    ?entries.filter(item=>['cash','bank','ewallet'].includes(item.type)).reduce((sum,item)=>sum+val(item),0)+loanTotalOutstanding()
    :entries.filter(item=>item.type===type).reduce((sum,item)=>sum+val(item),0);
  $('#targetList').innerHTML=['gold','stock','saving','cash'].map(type=>{
    const actual=total?actualValue(type)/total*100:0;
    const wanted=Number(targets[type]||0);
    return '<div class="metric"><span>'+types[type]+' · mục tiêu '+wanted+'%</span><strong>'+actual.toFixed(1)+'% ('+(actual-wanted>=0?'+':'')+(actual-wanted).toFixed(1)+'%)</strong></div>';
  }).join('');
}
async function setTargets(){
  const fields=['gold','stock','saving','cash'].map(type=>({name:type,label:types[type]+' mục tiêu (%)',type:'number',value:targets[type]||0}));
  const result=await openSheet({title:'Mục tiêu phân bổ',fields});if(!result)return;
  fields.forEach(field=>{const value=Number(A.parseQty(result[field.name]));targets[field.name]=Math.max(0,Math.min(100,value))});
  write(K.targets,targets);renderTargets();
}
function transactionImpact(t,deltas,sign){if(!t)return;Object.entries(transactionDeltas(t)).forEach(([id,amount])=>deltas[id]=(deltas[id]||0)+amount*sign);if(t.type==='expense'&&t.category==='Trả nợ'&&t.debtId)deltas['debt:'+t.debtId]=(deltas['debt:'+t.debtId]||0)-money(t.principal??t.amount)*sign}
function applyTxChange(){/* Balances are derived from the ledger. */}
function renderRecurring(){
  const current=today(),month=current.slice(0,7),day=Number(current.slice(8)),due=recurring.filter(item=>day>=Number(item.day||1)&&item.lastMonth!==month);
  const dueBanner=due.length?'<div class="due-banner">Đến hạn: '+due.map(item=>A.esc(item.name)).join(', ')+'</div>':'';const dueHost=$('#recurringDue'),topReminder=$('#recurringReminder');if(dueHost)dueHost.innerHTML=dueBanner;if(topReminder)topReminder.innerHTML=dueBanner;
  const host=$('#recurringList');if(!host)return;
  host.innerHTML=recurring.length?recurring.map((item,index)=>'<div class="cat-line"><span>'+A.esc(item.name)+' · '+vnd(item.amount)+' · ngày '+item.day+'</span><span class="mini-actions"><button class="btn" data-rec-run="'+index+'" '+(due.includes(item)?'':'disabled')+'>Ghi nhận</button><button class="btn" data-rec-edit="'+index+'">Sửa</button><button class="del" data-rec-del="'+index+'">×</button></span></div>').join(''):'<p class="note">Chưa có giao dịch định kỳ. Bấm “＋ Thêm” để tạo lịch.</p>';
  host.onclick=async event=>{
    const del=event.target.closest('[data-rec-del]')?.dataset.recDel;
    if(del!==undefined){if(!await confirmSheet('Xóa giao dịch định kỳ','Xóa lịch “'+recurring[Number(del)].name+'”?'))return;recurring.splice(Number(del),1);write(K.recurring,recurring);renderRecurring();return}
    const edit=event.target.closest('[data-rec-edit]')?.dataset.recEdit;
    if(edit!==undefined){await addRecurring(Number(edit));return}
    const index=event.target.closest('[data-rec-run]')?.dataset.recRun;if(index===undefined)return;
    const item=recurring[Number(index)],key=item.type+':'+item.id+':'+month;
    if(localStorage.getItem('so-dau-tu-recurring-recorded-'+key)){A.toast('Đã ghi nhận khoản này trong kỳ');return}
    const entry={id:crypto.randomUUID(),date:current,type:item.type,amount:item.amount,category:item.category,categoryId:item.categoryId,note:item.name,walletId:item.walletId};
    saveTx(tx().concat(entry));localStorage.setItem('so-dau-tu-recurring-recorded-'+key,'1');item.lastMonth=month;write(K.recurring,recurring);renderAll();A.toast('Đã ghi nhận giao dịch');
  };
}
async function addRecurring(index=null){
  const wallets=allWallets();if(!wallets.length){A.toast('Chưa có ví.');return}
  const old=index===null?null:recurring[index],typeOptions=[{value:'expense',label:'Chi'},{value:'income',label:'Thu'}];
  const result=await openSheet({title:old?'Sửa giao dịch định kỳ':'Thêm giao dịch định kỳ',fields:[
    {name:'name',label:'Tên khoản',value:old?.name||'',required:true},
    {name:'type',label:'Loại',type:'select',options:typeOptions,value:old?.type||'expense'},
    {name:'amount',label:'Số tiền (₫)',type:'money',value:old?A.formatCanonicalMoney(old.amount):'',required:true},
    {name:'category',label:'Danh mục',type:'select',options:categoryRecords.filter(record=>!record.hidden).map(record=>({value:record.id,label:record.name})),value:old?.categoryId||''},
    {name:'walletId',label:'Ví',type:'select',options:wallets.map(wallet=>({value:wallet.id,label:wallet.name})),value:old?.walletId||wallets[0].id},
    {name:'day',label:'Ngày trong tháng (1–28)',type:'number',value:old?.day||1}
  ],render:form=>{const type=form.elements.type,category=form.elements.category;const update=()=>{const selected=category.value,records=categoryRecords.filter(record=>record.type===(type.value==='income'?'income':'expense')&&!record.hidden);category.innerHTML=records.map(record=>'<option value=\"'+A.esc(record.id)+'\">'+A.esc(record.name)+'</option>').join('');if(records.some(record=>record.id===selected))category.value=selected};type.onchange=update;update()}});if(!result)return;
  const category=categoryRecords.find(record=>record.id===result.category&&record.type===(result.type==='income'?'income':'expense')),amount=money(result.amount),day=Math.max(1,Math.min(28,Number(result.day)||1));if(!category||amount<=0)return;
  const next={...(old||{}),id:old?.id||crypto.randomUUID(),name:result.name.trim(),type:result.type,amount,category:category.name,categoryId:category.id,walletId:result.walletId,day,lastMonth:old?.lastMonth||''};
  if(old)recurring[index]=next;else recurring.push(next);write(K.recurring,recurring);renderRecurring();
}
function renderMaturity(){
  const savings=assets().filter(item=>item.type==='saving'&&!item.matured&&item.startDate&&item.term),now=new Date();
  const list=savings.map(item=>{const date=new Date(item.startDate+'T12:00:00');date.setMonth(date.getMonth()+Number(item.term));return {item,date,days:Math.ceil((date-now)/86400000)}}).sort((left,right)=>left.days-right.days).filter(entry=>entry.days<31);
  const host=$('#maturityList');if(!host)return;
  host.innerHTML=list.length?list.map(entry=>'<div class="cat-line"><span>'+A.esc(entry.item.name||'Tiết kiệm')+' · '+(entry.days<0?'Đã đáo hạn':entry.days===0?'Đáo hạn hôm nay':'còn '+entry.days+' ngày')+'</span><button class="btn" data-maturity="'+A.esc(entry.item.id)+'">Ghi nhận đáo hạn</button></div>').join(''):'<p class="note">Không có sổ đáo hạn trong 30 ngày tới.</p>';
  host.onclick=async event=>{const id=event.target.closest('[data-maturity]')?.dataset.maturity;if(!id)return;const item=assets().find(row=>row.id===id),wallets=allWallets().filter(wallet=>wallet.assetId!==id);if(!item||!wallets.length)return;const result=await openSheet({title:'Ghi nhận đáo hạn · '+item.name,fields:[{name:'walletId',label:'Ví nhận gốc',type:'select',options:wallets.map(wallet=>({value:wallet.id,label:wallet.name}))},{name:'interest',label:'Lãi thực nhận (₫)',type:'money',value:'0'}]});if(!result)return;const target=wallets.find(wallet=>wallet.id===result.walletId);if(!target)return;const principal=walletBalance(item),interest=money(result.interest),entries=tx().concat({id:crypto.randomUUID(),date:today(),type:'transfer',amount:principal,fromWallet:walletIdFor(item),toWallet:target.id,category:'Chuyển tiền',note:'Đáo hạn: '+(item.name||'Sổ tiết kiệm')},{id:crypto.randomUUID(),date:today(),type:'income',amount:interest,category:'Lãi tiết kiệm',note:'Lãi đáo hạn: '+(item.name||'Sổ tiết kiệm'),walletId:target.id});item.matured=true;saveAssets(assets());saveTx(entries);renderAll();A.toast('Đã ghi nhận đáo hạn')};
}
function saveSnapshot(){const sum=assets().filter(x=>x.type!=='debt').reduce((s,x)=>s+val(x),0)+loanTotalOutstanding(),m=today().slice(0,7);snaps=snaps.filter(x=>x.month!==m);snaps.push({month:m,value:sum});write(K.snaps,snaps);renderSnapshots();A.toast('Đã lưu ảnh chụp tài sản tháng này')}
function renderSnapshots(){const data=snaps.slice().sort((a,b)=>a.month.localeCompare(b.month));if(!data.length){$('#snapshotChart').innerHTML='<p class=\"note\">Ảnh chụp sẽ tự tạo khi danh mục được lưu.</p>';return}const max=Math.max(1,...data.map(x=>x.value)),min=Math.min(...data.map(x=>x.value)),range=max-min||1,points=data.map((x,i)=>({x:i/(Math.max(1,data.length-1))*380+10,y:180-(x.value-min)/range*150})),pts=points.map(p=>p.x+','+p.y).join(' '),dots=points.map(p=>'<circle cx=\"'+p.x+'\" cy=\"'+p.y+'\" r=\"5\" fill=\"#1c694b\"/>').join(''),last=data[data.length-1];$('#snapshotChart').innerHTML='<svg viewBox=\"0 0 400 200\" width=\"100%\" height=\"200\"><polyline points=\"'+pts+'\" fill=\"none\" stroke=\"#1c694b\" stroke-width=\"3\" stroke-linejoin=\"round\"/>'+dots+'<text x=\"10\" y=\"18\" fill=\"currentColor\" font-size=\"12\">Tổng tài sản: '+A.esc(vnd(last.value))+'</text>'+data.map((x,i)=>'<text x=\"'+points[i].x+'\" y=\"198\" fill=\"currentColor\" font-size=\"9\">'+A.esc(x.month.slice(5))+'</text>').join('')+'</svg>'}async function manageCategories(){
  const typeResult=await openSheet({title:'Danh mục',fields:[{name:'type',label:'Loại danh mục',type:'select',options:[{value:'expense',label:'Chi'},{value:'income',label:'Thu'}]}]});
  if(!typeResult)return;const kind=typeResult.type;
  const records=categoryRecords.filter(record=>record.type===kind&&!record.hidden);
  const result=await openSheet({title:'Quản lý danh mục',fields:[
    {name:'action',label:'Thao tác',type:'select',options:[{value:'add',label:'Thêm danh mục'},{value:'rename',label:'Đổi tên'},{value:'hide',label:'Ẩn danh mục'}]},
    {name:'category',label:'Danh mục hiện có',type:'select',options:records.map(record=>({value:record.id,label:record.name}))},
    {name:'name',label:'Tên mới (khi thêm hoặc đổi tên)'},
    {name:'icon',label:'Biểu tượng',value:'•'},
    {name:'color',label:'Màu HEX',value:'#1c694b'}
  ]});
  if(!result)return;
  if(result.action==='add'){
    const name=result.name.trim();if(!name)return;
    if(records.some(record=>record.name.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi'))){A.toast('Danh mục đã tồn tại');return}
    const color=/^#[0-9a-f]{6}$/i.test(result.color)?result.color:'#1c694b';
    const record={id:categorySlug(kind,name),name,type:kind,icon:result.icon||'•',color,hidden:false};
    categoryRecords.push(record);categoryMap.set(record.id,record);cat[kind].push(name);
  }else{
    const record=categoryRecords.find(item=>item.id===result.category);if(!record)return;
    if(result.action==='hide')record.hidden=true;
    else if(result.name.trim()){
      const oldName=record.name;record.name=result.name.trim();
      cat[kind]=cat[kind].map(value=>value===oldName?record.name:value);
      tx().forEach(transaction=>{if(transaction.categoryId===record.id)transaction.category=record.name});
      recurring.forEach(item=>{if(item.categoryId===record.id)item.category=record.name});
    }
  }
  write(CATEGORY_KEY,categoryRecords);write(K.cats,cat);write(K.recurring,recurring);A.setTransactions(tx());renderAll();
}
async function tradeForm(){
  const tradable=assets().filter(item=>(item.type==='gold'||item.type==='stock')&&!item.closed);
  if(!tradable.length){A.toast('Thêm vàng hoặc cổ phiếu trước');return}
  const wallets=allWallets();if(!wallets.length){A.toast('Chưa có ví để chọn');return}
  const result=await openSheet({title:'Ghi mua/bán',fields:[
    {name:'assetId',label:'Khoản đầu tư',type:'select',options:tradable.map(item=>({value:item.id,label:item.name+' · '+types[item.type]}))},
    {name:'side',label:'Loại giao dịch',type:'select',options:[{value:'buy',label:'Mua'},{value:'sell',label:'Bán'}]},
    {name:'qty',label:'Khối lượng / số cổ phiếu',type:'number',required:true},
    {name:'price',label:'Giá mỗi đơn vị (₫)',type:'money',required:true},
    {name:'walletId',label:'Ví tiền',type:'select',options:wallets.map(wallet=>({value:wallet.id,label:wallet.name+' · '+vnd(wallet.balance)}))}
  ]});if(!result)return;
  const position=assets().find(item=>item.id===result.assetId),wallet=allWallets().find(item=>item.id===result.walletId);
  const qty=A.parseQty(result.qty),price=money(result.price);if(!position||!wallet||qty<=0||price<=0)return;
  if(result.side==='sell'&&qty>A.num(position.qty)){A.toast('Số lượng bán vượt quá số đang nắm giữ');return}
  const amount=Math.round(qty*price);
  if(result.side==='buy'&&localStorage.getItem('so-dau-tu-block-overdraft')==='1'&&wallet.balance<amount){A.toast('Số dư ví không đủ cho giao dịch mua');return}
  const list=assets(),item=list.find(entry=>entry.id===position.id);let realized=0,allocatedFee=0;
  if(result.side==='sell'){
    const heldQty=A.num(item.qty),feeBefore=A.num(item.fee);allocatedFee=heldQty?feeBefore*qty/heldQty:0;
    realized=(price-A.num(item.price))*qty-allocatedFee;item.qty=Math.max(0,heldQty-qty);item.fee=Math.max(0,feeBefore-allocatedFee);
    if(item.qty<=1e-9){item.qty=0;item.fee=0;item.closed=true}
  }else{const oldQty=A.num(item.qty),newQty=oldQty+qty;item.price=(A.num(item.price)*oldQty+price*qty)/newQty;item.qty=newQty;item.closed=false}
  item.currentPrice=price;saveAssets(list);
  saveTx(tx().concat({id:crypto.randomUUID(),date:today(),type:'trade',kind:'trade',side:result.side,amount,walletId:wallet.id,assetId:item.id,note:(result.side==='buy'?'Mua tài sản: ':'Bán tài sản: ')+item.name}));
  trades.push({id:crypto.randomUUID(),assetId:item.id,assetType:item.type,date:today(),asset:item.name,type:result.side,qty,price,amount:qty*price,realized,fee:allocatedFee,wallet:wallet.name});write(K.trades,trades);renderAll();
}
function tradeAssetType(t){if(t.assetType==='gold'||t.assetType==='stock')return t.assetType;const item=assets().find(x=>x.id===t.assetId)||assets().find(x=>x.name===t.asset);return item?.type==='stock'?'stock':'gold'}
function ensureInitialTrades(){let changed=false;assets().filter(x=>(x.type==='gold'||x.type==='stock')&&!x.closed&&A.num(x.qty)>0).forEach(x=>{const linked=trades.some(t=>t.assetId===x.id||(!t.assetId&&t.asset===x.name));if(!linked){trades.push({id:crypto.randomUUID(),assetId:x.id,assetType:x.type,asset:x.name||types[x.type],type:'buy',qty:A.num(x.qty),price:A.num(x.price),amount:val(x),realized:0,date:x.buyDate||today(),baseline:true});changed=true}});if(changed)write(K.trades,trades)}
function syncBaselineTrade(item){const base=trades.find(t=>t.baseline&&t.assetId===item.id);if(!base||trades.some(t=>t.assetId===item.id&&!t.baseline))return;base.asset=item.name||types[item.type];base.assetType=item.type;base.date=item.buyDate||base.date;base.qty=A.num(item.qty);base.price=A.num(item.price);base.amount=val(item);write(K.trades,trades)}
function renderTradeRows(id,type){const list=trades.filter(t=>tradeAssetType(t)===type).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));$('#'+id).innerHTML=list.length?list.map(t=>'<tr><td>'+A.esc(t.date||'—')+'</td><td>'+A.esc(t.asset||'')+'</td><td>'+(t.type==='buy'?'Mua':'Bán')+(t.baseline?' · ban đầu':'')+'</td><td class="num">'+t.qty+'</td><td class="num">'+vnd(t.price)+'</td><td class="num">'+vnd(t.amount??(A.num(t.qty)*A.num(t.price)))+'</td><td class="num">'+(t.type==='sell'?vnd(t.realized):'—')+'</td></tr>').join(''):'<tr><td colspan="7" class="empty">Chưa có lịch sử '+(type==='gold'?'mua vàng':'mua cổ phiếu')+'.</td></tr>'}
function renderTrades(){
  ensureInitialTrades();renderTradeRows('goldTradeList','gold');renderTradeRows('stockTradeList','stock');
  const list=assets().filter(item=>(item.type==='gold'||item.type==='stock')&&!item.closed);
  $('#pnlList').innerHTML=list.length?list.map(item=>{const average=A.num(item.price),current=A.num(item.currentPrice),pnl=(current-average)*A.num(item.qty);return '<div class="metric"><span>'+A.esc(item.name)+' · Giá hiện tại '+vnd(current)+' <button class="btn" data-price="'+A.esc(item.id)+'">Cập nhật giá</button></span><strong class="'+(pnl<0?'expense':'income')+'">'+(current?vnd(pnl)+' ('+(average?(pnl/(average*A.num(item.qty)||1)*100).toFixed(1):'0')+'%)':'Chưa có giá')+'</strong></div>'}).join(''):'<p class="note">Chưa có vàng hoặc cổ phiếu để cập nhật giá.</p>';
  $('#pnlList').onclick=async event=>{const id=event.target.closest('[data-price]')?.dataset.price;if(!id)return;const item=assets().find(value=>value.id===id);const result=await openSheet({title:'Cập nhật giá thị trường',fields:[{name:'price',label:'Giá mỗi đơn vị (₫)',type:'money',value:A.formatCanonicalMoney(item?.currentPrice||item?.price||0)}]});if(!result)return;const price=money(result.price);if(!price)return;saveAssets(assets().map(value=>value.id===id?{...value,currentPrice:price}:value));renderAll()};
}
function syncCurrentSnapshot(){const m=today().slice(0,7),sum=assets().filter(x=>x.type!=='debt').reduce((s,x)=>s+val(x),0)+loanTotalOutstanding(),idx=snaps.findIndex(x=>x.month===m);if(idx>=0&&snaps[idx].value===sum)return;if(idx>=0)snaps[idx]={month:m,value:sum};else snaps.push({month:m,value:sum});write(K.snaps,snaps)}
function renderAll(){A.renderInvestment();renderWallets();renderLoanPanel();const f=$('#categoryFilter'),previous=f?.value;const visible=categoryRecords.filter(record=>!record.hidden),all=new Map(tx().filter(item=>item.category).map(item=>{const record=categoryRecords.find(category=>category.id===item.categoryId)||ensureCategory(categoryType(item),item.category);return [record.id,record]}));if(f){f.innerHTML='<option value="">Tất cả danh mục</option>'+Array.from(all.values()).sort((a,b)=>a.name.localeCompare(b.name,'vi')).map(record=>'<option value="'+A.esc(record.id)+'">'+A.esc(record.name)+'</option>').join('');f.value=previous||''}if(!$('#periodWeek').dataset.bound){$('#periodWeek').onclick=()=>setReportMode('week');$('#periodMonth').onclick=()=>setReportMode('month');$('#prevMonth').onclick=()=>shiftReport(-1);$('#nextMonth').onclick=()=>shiftReport(1);$('#valuationMode').value=localStorage.getItem('so-dau-tu-valuation-mode')||'cost';$('#valuationMode').onchange=event=>{localStorage.setItem('so-dau-tu-valuation-mode',event.target.value);renderAll()};$('#periodWeek').dataset.bound='1'}const range=reportRange();$('#periodWeek').classList.toggle('primary',range.mode==='week');$('#periodMonth').classList.toggle('primary',range.mode==='month');$('#budgetTitle').textContent='Ngân sách tháng '+range.month;$('#donutTitle').textContent='Chi tiêu theo danh mục · '+range.label;$('#cumulativeTitle').textContent='Số dư cộng dồn · '+range.label;const jobs=[()=>A.renderTransactions(),renderBudgets,chartExpenses,renderBars,renderCumulative,renderHealth,renderGoals,renderTargets,renderMaturity,renderTrades,renderRecurring,()=>{syncCurrentSnapshot();renderSnapshots()}];jobs.forEach(fn=>{try{fn()}catch(error){console.error('Sổ đầu tư: không thể cập nhật một khối giao diện',error)}})}
function csvCell(x){return '\"'+String(x??'').replace(/\"/g,'\"\"')+'\"'}
function downloadCsv(name,rows){const csv='\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),a=document.createElement('a'),u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=u;a.download=name+'-'+today()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function exportCsv(){downloadCsv('so-dau-tu',[['THU CHI'],['date','type','amount','category','wallet','note'],...tx().map(t=>[t.date,t.type,t.amount,t.category,t.walletId||t.fromWallet||'',t.note]),[],['DANH MUC DAU TU'],['type','name','quantity','purchase_price','current_price','amount','date'],...assets().map(x=>[x.type,x.name,x.qty,x.price,x.currentPrice,x.amount,x.buyDate||x.startDate||x.asOf])])}function toggleDark(){document.documentElement.classList.toggle('dark');localStorage.setItem(K.dark,document.documentElement.classList.contains('dark')?'1':'0')}
function toggleBalances(){document.documentElement.classList.toggle('hide-balances');localStorage.setItem(K.hide,document.documentElement.classList.contains('hide-balances')?'1':'0')}
async function pinHash(p){if(!globalThis.crypto?.subtle)return 'plain:'+p;const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p));return 'sha256:'+Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function pinOverlay(){
  if(!localStorage.getItem(K.pin)||document.querySelector('.pin-screen'))return;
  const overlay=document.createElement('div');overlay.className='pin-screen';
  overlay.innerHTML='<div class="pin-box"><h2>Sổ đầu tư đang khóa</h2><p>Nhập mã PIN từ 4 đến 6 số để mở ứng dụng.</p><input id="pinEntry" type="password" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" autocomplete="current-password"><p class="small">PIN chỉ che màn hình, không mã hóa dữ liệu.</p><button class="btn primary" id="pinUnlock">Mở khóa</button></div>';
  document.body.append(overlay);document.querySelector('.shell').style.filter='blur(8px)';
  $('#pinUnlock').onclick=async()=>{const value=$('#pinEntry').value,saved=localStorage.getItem(K.pin),hash=await pinHash(value);if(saved===hash||saved==='plain:'+value||saved===value){overlay.remove();document.querySelector('.shell').style.filter=''}else A.toast('PIN chưa đúng')};
}
async function setupPin(){
  const current=localStorage.getItem(K.pin);
  const fields=[];if(current)fields.push({name:'current',label:'PIN hiện tại',type:'password'});
  fields.push({name:'pin',label:'PIN mới (4–6 chữ số, để trống để tắt)',type:'password'});
  fields.push({name:'confirm',label:'Nhập lại PIN mới',type:'password'});
  const result=await openSheet({title:'Khóa màn hình',fields,render:form=>{form.insertAdjacentHTML('beforeend','<p class="note">Tự khóa lại khi quay về ứng dụng sau ít nhất 1 phút ở nền. PIN chỉ che màn hình, không mã hóa dữ liệu.</p>')}});if(!result)return;
  if(current){const hash=await pinHash(result.current);if(current!==hash&&current!=='plain:'+result.current&&current!==result.current){A.toast('PIN hiện tại chưa đúng');return}}
  if(!result.pin){localStorage.removeItem(K.pin);A.toast('Đã tắt khóa màn hình');return}
  if(!/^\d{4,6}$/.test(result.pin)||result.pin!==result.confirm){A.toast('PIN cần gồm 4–6 chữ số trùng nhau');return}
  localStorage.setItem(K.pin,await pinHash(result.pin));A.toast('Đã lưu PIN màn hình');
}
function refreshWallets(){const cash=allWallets(),editing=tx().find(t=>t.id===window.__editingTxId);['#txWallet','#txToWallet'].forEach(sel=>{const el=$(sel);if(!el)return;const source=sel==='#txWallet',old=el.value,editingId=source?(editing?.walletId||editing?.fromWallet||''):(editing?.toWallet||''),selected=old||editingId,blank=source?'Chọn tài khoản tiền mặt':'Chọn tài khoản nhận tiền mặt',list=cash.slice(),legacy=selected?assets().find(x=>x.type==='saving'&&'asset:'+x.id===selected):null;if(legacy)list.push({id:selected,name:(legacy.name||types.saving)+' · giao dịch cũ',balance:A.num(legacy.amount),legacy:true});el.innerHTML='<option value="">'+blank+'</option>'+list.map(w=>'<option value="'+A.esc(w.id)+'" '+(w.legacy?'disabled ':'')+'>'+A.esc(w.name)+' · '+vnd(w.balance)+'</option>').join('');el.value=list.some(w=>w.id===selected)?selected:''})}function initTransactionExtras(){const type=$('#txType');if(!type||type.dataset.extrasInitialized==='1')return;type.dataset.extrasInitialized='1';if(!type.querySelector('option[value="transfer"]'))type.insertAdjacentHTML('beforeend','<option value="transfer">Chuyển</option>');if(!$('#txWallet')){$('#txNote').parentElement.insertAdjacentHTML('afterend',walletSelect('txWallet','','Ví nguồn / nhận')+walletSelect('txToWallet','','Ví nhận')+'<div class="field tx-wallet" id="debtFields" hidden><label for="txDebt">Khoản nợ được trả</label><select id="txDebt"></select><label for="txPrincipal">Phần gốc trả (₫)</label><input id="txPrincipal" type="text" inputmode="decimal" data-number="true" data-money="true" placeholder="Mặc định bằng toàn bộ khoản chi"></div>')}const source=$('#txWallet'),dest=$('#txToWallet');refreshWallets();function updateForm(){const transfer=type.value==='transfer';source.hidden=false;dest.hidden=!transfer;const sourceLabel=source.parentElement.querySelector('label');if(sourceLabel)sourceLabel.textContent=transfer?'Tài khoản chuyển đi':type.value==='income'?'Tài khoản nhận tiền':'Tài khoản trừ tiền';const c=$('#txCategory');if(transfer){c.innerHTML='<option>Chuyển tiền</option>';c.disabled=true}else{c.disabled=false;const typeName=type.value==='income'?'income':'expense',records=categoryRecords.filter(record=>record.type===typeName&&!record.hidden),selectedId=c.value||window.__editingTxId&&tx().find(item=>item.id===window.__editingTxId)?.categoryId||'',legacy=tx().filter(item=>item.type===type.value&&item.category&&!records.some(record=>record.name===item.category)).map(item=>({id:categorySlug(typeName,item.category),name:item.category})),list=records.concat(legacy);c.innerHTML=list.map(record=>'<option value="'+A.esc(record.id)+'">'+A.esc(record.name)+'</option>').join('');if(list.some(record=>record.id===selectedId))c.value=selectedId;else if(list[0])c.value=list[0].id}const debtOn=type.value==='expense'&&c.selectedOptions[0]?.textContent==='Trả nợ';$('#debtFields').hidden=!debtOn;$('#txDebt').innerHTML=assets().filter(x=>x.type==='debt').map(x=>'<option value="'+A.esc(x.id)+'">'+A.esc(x.name||'Khoản nợ')+' · '+vnd(x.amount)+'</option>').join('')||'<option value="">Chưa có khoản nợ</option>'}type.onchange=updateForm;$('#txCategory').onchange=updateForm;updateForm();
$('#saveTransaction').onclick=()=>{const amount=Math.round(A.parseMoney($('#txAmount').value)),tType=type.value,date=$('#txDate').value;if(!amount||!date){A.toast('Nhập ngày và số tiền lớn hơn 0');return}const id=window.__editingTxId||null,arr=tx(),old=id?arr.find(x=>x.id===id):null;if(!source.value){A.toast(tType==='transfer'?'Chọn tài khoản chuyển đi':'Chọn tài khoản thu/chi');return}if(tType==='transfer'&&(!dest.value||dest.value===source.value)){A.toast('Chọn hai tài khoản khác nhau');return}const linked=allWallets().find(w=>w.id===source.value);let available=linked?.balance||0;if(old){if(old.type==='income'&&old.walletId===source.value)available-=A.num(old.amount);if(old.type==='expense'&&old.walletId===source.value)available+=A.num(old.amount);if(old.type==='transfer'){if(old.fromWallet===source.value)available+=A.num(old.amount);if(old.toWallet===source.value)available-=A.num(old.amount)}}if(localStorage.getItem('so-dau-tu-block-overdraft')==='1'&&(tType==='expense'||tType==='transfer')&&amount>available){A.toast('Số dư tài khoản không đủ cho giao dịch này');return}const principalRaw=$('#txPrincipal').value,principal=Math.min(amount,principalRaw.trim()?money(principalRaw):amount),debtId=$('#txDebt').value;const entry={id:id||crypto.randomUUID(),loanMigrationHandled:old?.loanMigrationHandled,date,type:tType,amount,category:tType==='transfer'?'Chuyển tiền':(categoryRecords.find(record=>record.id===$('#txCategory').value)?.name||$('#txCategory').selectedOptions[0]?.textContent||'Khác'),categoryId:tType==='transfer'?'':$('#txCategory').value,note:$('#txNote').value.trim(),walletId:source.value,fromWallet:tType==='transfer'?source.value:'',toWallet:tType==='transfer'?dest.value:'',debtId:tType==='expense'&&$('#txCategory').selectedOptions[0]?.textContent==='Trả nợ'?debtId:'',principal:tType==='expense'&&$('#txCategory').selectedOptions[0]?.textContent==='Trả nợ'?principal:0};const next=old?arr.map(x=>x.id===id?entry:x):arr.concat(entry);applyTxChange(old,entry);A.setWeek(A.getWeek(entry.date));saveTx(next);$('#transactionModal').classList.remove('open');window.__editingTxId=null;renderAll();A.toast('Đã lưu giao dịch')};$('#transactionsBody').addEventListener('click',event=>{const loanId=event.target.closest('[data-open-loan]')?.dataset.openLoan;if(loanId)window.__loanAPI?.openLoan(loanId)});$('#transactionsBody').onclick=async event=>{
  const del=event.target.closest('[data-tx-delete]')?.dataset.txDelete,edit=event.target.closest('[data-tx-edit]')?.dataset.txEdit;
  if(del){const old=tx().find(item=>item.id===del);if(!old)return;if(['adjust','invest','trade','lend','repay'].includes(old.kind)){A.toast('Thay đổi giao dịch này từ khoản liên quan.');return}if(!await confirmSheet('Xóa giao dịch','Bạn có chắc muốn xóa giao dịch này?'))return;saveTx(tx().filter(item=>item.id!==del));renderAll();recordDeleteUndo('Đã xóa giao dịch',old,()=>{saveTx(tx().concat(old));renderAll()});return}
  if(edit){const old=tx().find(item=>item.id===edit);if(!old)return;if(['adjust','invest','trade','lend','repay'].includes(old.kind)){A.toast('Thay đổi giao dịch này từ khoản liên quan.');return}window.__editingTxId=old.id;$('#txDate').value=old.date;type.value=old.type;$('#txAmount').value=old.amount;$('#txNote').value=old.note||'';refreshWallets();type.dispatchEvent(new Event('change'));$('#txWallet').value=old.walletId||old.fromWallet||'';$('#txToWallet').value=old.toWallet||'';if(old.category&&old.type!=='transfer'){const categoryId=old.categoryId||window.__categoryAPI.idForTransaction(old);$('#txCategory').value=categoryId;$('#txCategory').dispatchEvent(new Event('change'))}$('#txDebt').value=old.debtId||'';$('#txPrincipal').value=old.principal||'';$('#transactionModal').classList.add('open')}
};
}document.addEventListener('focusout',e=>{const el=e.target;if(!(el instanceof HTMLInputElement))return;if(el.dataset.money!==undefined&&el.value.trim())el.value=A.formatMoneyInput(el.value);else if(el.dataset.number!==undefined&&el.value.trim())el.value=A.formatQtyInput(el.value)});const originalInvestmentSave=$('#saveBtn').onclick;
const fieldsObserver=new MutationObserver(()=>injectCurrentPrice());fieldsObserver.observe($('#fields'),{childList:true,subtree:true});
function injectCurrentPrice(){const fields=$('#fields'),type=$('#type')?.value,modal=$('#modal');if(!fields)return;const id=modal?.dataset.assetId||null,current=id?assets().find(item=>item.id===id)?.currentPrice||'':'';if((type==='gold'||type==='stock')&&!fields.querySelector('#currentPrice'))fields.insertAdjacentHTML('beforeend','<div class="field"><label for="currentPrice">Giá hiện tại mỗi đơn vị (₫)</label><input id="currentPrice" type="text" inputmode="decimal" data-number="true" data-money="true" value="'+A.esc(A.formatCanonicalMoney(current))+'"></div>');if(['gold','stock','saving'].includes(type)&&!id&&!fields.querySelector('#assetFundingWallet')){const options=allWallets().map(wallet=>'<option value="'+A.esc(wallet.id)+'">'+A.esc(wallet.name)+' · '+vnd(wallet.balance)+'</option>').join('');fields.insertAdjacentHTML('beforeend','<div class="field full"><label for="assetFundingWallet">Nguồn tiền</label><select id="assetFundingWallet"><option value="">Tài sản có sẵn (không trừ ví)</option>'+options+'</select></div>')}}
$('#saveBtn').onclick=async()=>{const id=$('#modal').dataset.assetId||null,priceInput=$('#currentPrice'),raw=priceInput?.value.trim()||'',price=raw?A.parseMoney(raw):null,funding=$('#assetFundingWallet')?.value||'',old=id?assets().find(item=>item.id===id):null,desiredInput=$('#f-amount'),desired=desiredInput?A.parseMoney(desiredInput.value):null,oldBalance=old&&WALLET_TYPES.includes(old.type)?walletBalance(old):null;if(oldBalance!==null&&desired!==null&&desired!==oldBalance&&!await confirmSheet('Điều chỉnh số dư','Số dư hiện tại là '+vnd(oldBalance)+'. Tạo giao dịch điều chỉnh?','Tạo điều chỉnh'))return;if(!id&&funding&&localStorage.getItem('so-dau-tu-block-overdraft')==='1'){const type=$('#type').value,price=money($('#f-price')?.value||'0'),qty=A.parseQty($('#f-qty')?.value||'0'),fee=money($('#f-fee')?.value||'0'),amount=Math.round(type==='gold'?price*qty+fee:type==='stock'?price*qty:money($('#f-amount')?.value||'0')),wallet=allWallets().find(item=>item.id===funding);if(wallet&&amount>wallet.balance){A.toast('Số dư ví không đủ cho khoản đầu tư này');return}}const before=assets().map(item=>item.id);originalInvestmentSave();if($('#modal').classList.contains('open'))return;let after=assets(),found=id?after.find(item=>item.id===id):after.find(item=>!before.includes(item.id));if(!found)return;if(oldBalance!==null&&desired!==null&&desired!==oldBalance){after=after.map(item=>item.id===found.id?{...item,amount:old.amount,openingBalance:old.openingBalance}:item);A.setItems(after);saveTx(tx().concat({id:crypto.randomUUID(),date:today(),type:'adjust',kind:'adjust',amount:desired-oldBalance,walletId:walletIdFor(found),note:'Điều chỉnh số dư'}))}if(!id&&funding){const amount=Math.round(found.type==='gold'?money(found.price)*A.num(found.qty)+money(found.fee):found.type==='stock'?money(found.price)*A.num(found.qty):money(found.amount));if(amount)saveTx(tx().concat({id:crypto.randomUUID(),date:found.buyDate||found.startDate||today(),type:'invest',kind:'invest',amount,walletId:funding,assetId:found.id,note:'Đầu tư: '+(found.name||types[found.type])}))}if(price!==null&&['gold','stock'].includes(found.type))A.updateItems(items=>items.map(item=>item.id===found.id?{...item,currentPrice:price}:item));if(found.type==='gold'||found.type==='stock')syncBaselineTrade(found);renderAll()};document.addEventListener('click',e=>{if(e.target.closest('[data-delete]'))setTimeout(renderAll,0)});function exportFullJson(){const backup={app:'so-dau-tu',version:2,exportedAt:new Date().toISOString(),investment:assets(),transactions:tx(),transactionBackup:JSON.parse(localStorage.getItem('thu-chi-v1-backup-before-week-edit')||'[]'),categories:cat,categoryMeta:categoryMeta,budgets:budgets,recurring:recurring,goals:goals,targets:targets,snapshots:snaps,trades:trades,loans:loans,categoryRecords:categoryRecords,defaultBudgets:defaultBudgets,reportPeriod:reportState,theme:localStorage.getItem('so-dau-tu-theme')||'auto'};const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='so-dau-tu-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);A.toast('Đã sao lưu đầy đủ dữ liệu')}
function importFullJson(){
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label','Chọn file sao lưu JSON');input.onchange=()=>{
    const file=input.files?.[0];if(!file){input.remove();return}const reader=new FileReader();
    reader.onerror=()=>{input.remove();A.toast('Safari không đọc được file JSON đã chọn')};
    reader.onload=async()=>{try{const data=JSON.parse(String(reader.result||''));if(!data||!Array.isArray(data.investment)||!Array.isArray(data.transactions))throw Error('format');if(!await confirmSheet('Khôi phục dữ liệu','Dữ liệu hiện có sẽ được thay thế. Tiếp tục?','Khôi phục'))return;A.setItems(data.investment);A.setTransactions(data.transactions);cat=data.categories||cat;categoryMeta=data.categoryMeta||{};budgets=data.budgets||{};recurring=data.recurring||[];goals=data.goals||[];targets=data.targets||{};snaps=data.snapshots||[];trades=data.trades||[];if(Array.isArray(data.loans)){loans=data.loans;write(LOAN_KEY,loans)}if(Array.isArray(data.categoryRecords)){categoryRecords=data.categoryRecords;categoryMap.clear();categoryRecords.forEach(record=>categoryMap.set(record.id,record));write(CATEGORY_KEY,categoryRecords)}if(data.defaultBudgets){defaultBudgets=data.defaultBudgets;write('thu-chi-default-budgets-v1',defaultBudgets)}if(data.reportPeriod){reportState=data.reportPeriod;saveReport()}if(data.theme)localStorage.setItem('so-dau-tu-theme',data.theme);write(K.cats,cat);write(K.categoryMeta,categoryMeta);write(K.budgets,budgets);write(K.recurring,recurring);write(K.goals,goals);write(K.targets,targets);write(K.snaps,snaps);write(K.trades,trades);localStorage.removeItem('so-dau-tu-report-categories-v1');migrateReportCategories();renderAll();A.toast('Đã khôi phục dữ liệu')}catch{A.toast('File JSON không đúng định dạng sao lưu')}finally{input.remove()}};
    reader.readAsText(file,'UTF-8')
  };document.body.append(input);input.click()
}
function backupBeforeLoanMigration(){
  const key='backup-before-loans-and-repayments';
  if(localStorage.getItem(key))return;
  const snapshot={};
  for(let index=0;index<localStorage.length;index++){
    const name=localStorage.key(index);
    snapshot[name]=localStorage.getItem(name);
  }
  localStorage.setItem(key,JSON.stringify(snapshot));
}

function loanPrincipalCollected(loan){
  return (loan.repayments||[]).reduce((sum,repayment)=>sum+money(repayment.principal),0);
}

function loanOutstanding(loan){
  if(loan.status==='xoa_no')return 0;
  return Math.max(0,money(loan.principal)-loanPrincipalCollected(loan));
}

function loanTotalOutstanding(){
  return loans.reduce((sum,loan)=>sum+loanOutstanding(loan),0);
}

function refreshLoanStatus(loan){
  if(loan.status!=='xoa_no')loan.status=loanOutstanding(loan)===0?'da_thu_hoi':'dang_vay';
  return loan;
}

function saveLoanState(nextLoans,nextTransactions=tx()){
  loans=nextLoans.map(refreshLoanStatus);
  write(LOAN_KEY,loans);
  saveTx(nextTransactions);
  renderAll();
  renderLoanPanel();
}

function loanCashflowSwitch(){
  return localStorage.getItem('so-dau-tu-count-lend-repay')!=='0';
}

function cashflowAmount(transaction,type){
  if(transaction.type!==type)return 0;
  if(loanCashflowSwitch())return money(transaction.amount);
  if(transaction.kind==='lend')return 0;
  if(transaction.kind==='repay'){
    return Math.max(0,money(transaction.amount)-money(transaction.principalCollected));
  }
  return money(transaction.amount);
}

function loanDateDays(date){
  if(!date)return null;
  const due=new Date(date+'T23:59:59');
  const now=new Date();
  now.setHours(0,0,0,0);
  return Math.ceil((due-now)/86400000);
}

function injectLoanPanel(){
  const home=$('#investmentExtras');
  if(!home||$('#loanPanel'))return;
  home.insertAdjacentHTML('afterbegin',
    '<section class="advanced-panel wide loan-panel" id="loanPanel">'+
      '<div class="panel-head"><div><h3>Khoản cho vay</h3><p class="small">Khoản phải thu của bạn, tính trong tổng tài sản.</p></div>'+
      '<button class="btn primary" id="addLoan">＋ Cho vay</button></div>'+ 
      '<div class="table-wrap loan-table-wrap"><table class="loan-table"><thead><tr><th>Người vay</th><th class="num">Gốc</th><th class="num">Đã thu gốc</th><th class="num">Còn nợ</th><th>Hạn trả</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody id="loanRows"></tbody></table></div>'+
    '</section>'
  );
  $('#addLoan').onclick=createLoan;
  $('#loanRows').onclick=handleLoanAction;
}

function renderLoanPanel(){
  const body=$('#loanRows');
  if(!body)return;
  body.innerHTML=loans.length?loans.map(loan=>{
    const collected=loanPrincipalCollected(loan);
    const outstanding=loanOutstanding(loan);
    const days=loanDateDays(loan.dueDate);
    const dueClass=days===null?'':days<0?'loan-overdue':days<=7?'loan-due-soon':'';
    const status=loan.status==='xoa_no'?'Đã xóa nợ':loan.status==='da_thu_hoi'?'Đã thu hồi':'Đang vay';
    const repayments=(loan.repayments||[]).map(repayment=>
      '<li><span>'+A.esc(repayment.date)+' · Gốc '+vnd(repayment.principal)+' · Lãi '+vnd(repayment.interest)+' · '+A.esc(walletName(repayment.receiveWallet))+'</span>'+ 
      '<span><button class="btn" data-repayment-edit="'+A.esc(loan.id)+'|'+A.esc(repayment.id)+'">Sửa</button> <button class="del" data-repayment-delete="'+A.esc(loan.id)+'|'+A.esc(repayment.id)+'">×</button></span></li>'
    ).join('');
    const details=repayments?'<details class="loan-repayments"><summary>Các lần thu hồi ('+(loan.repayments||[]).length+')</summary><ul>'+repayments+'</ul></details>':'';
    const actions='<button class="btn" data-loan-repay="'+A.esc(loan.id)+'" '+(outstanding===0?'disabled':'')+'>Thu hồi</button> '+
      '<button class="btn" data-loan-writeoff="'+A.esc(loan.id)+'" '+(outstanding===0||loan.status==='xoa_no'?'disabled':'')+'>Xóa nợ</button> '+
      '<button class="btn" data-loan-edit="'+A.esc(loan.id)+'">Sửa</button> '+
      '<button class="del" data-loan-delete="'+A.esc(loan.id)+'" aria-label="Xóa khoản cho vay">×</button>';
    return '<tr class="'+dueClass+'"><td data-label="Người vay"><strong>'+A.esc(loan.name)+'</strong>'+details+'</td><td data-label="Gốc" class="num">'+vnd(loan.principal)+'</td><td data-label="Đã thu gốc" class="num">'+vnd(collected)+'</td><td data-label="Còn nợ" class="num">'+vnd(outstanding)+'</td><td data-label="Hạn trả">'+A.esc(loan.dueDate||'—')+'</td><td data-label="Trạng thái">'+status+'</td><td data-label="Thao tác"><div class="loan-actions">'+actions+'</div></td></tr>';
  }).join(''):'<tr><td colspan="7" class="empty">Chưa có khoản cho vay nào.</td></tr>';
}

function walletName(id){
  const wallet=allWallets(true).find(item=>item.id===id);
  return wallet?.name||'Ví chưa xác định';
}

async function chooseLoanWallet(label,currentId=''){
  const wallets=allWallets();if(!wallets.length){A.toast('Tạo ví trước khi ghi nhận khoản vay.');return null}
  const result=await openSheet({title:label,fields:[{name:'walletId',label:'Ví',type:'select',value:currentId||wallets[0].id,options:wallets.map(wallet=>({value:wallet.id,label:wallet.name+' · '+vnd(wallet.balance)}))}]});
  return result?wallets.find(wallet=>wallet.id===result.walletId)||null:null;
}
async function createLoan(){
  const wallets=allWallets();if(!wallets.length){A.toast('Tạo ví trước khi ghi nhận khoản vay.');return}
  const result=await openSheet({title:'Cho vay',fields:[{name:'name',label:'Tên người vay',required:true},{name:'principal',label:'Gốc (₫)',type:'money',required:true},{name:'sourceWallet',label:'Ví nguồn',type:'select',options:wallets.map(wallet=>({value:wallet.id,label:wallet.name+' · '+vnd(wallet.balance)}))},{name:'loanDate',label:'Ngày cho vay',type:'date',value:today()},{name:'dueDate',label:'Hạn trả',type:'date'},{name:'rate',label:'Lãi suất (%/năm)',type:'number',value:'0'},{name:'note',label:'Ghi chú'}]});if(!result)return;
  const principal=money(result.principal),wallet=wallets.find(item=>item.id===result.sourceWallet);if(!wallet||principal<=0)return;
  if(localStorage.getItem('so-dau-tu-block-overdraft')==='1'&&principal>wallet.balance){A.toast('Số dư ví không đủ cho khoản cho vay này.');return}
  const loan={id:crypto.randomUUID(),name:result.name.trim(),principal,loanDate:result.loanDate,sourceWallet:wallet.id,dueDate:result.dueDate,rate:A.parseQty(result.rate||'0'),note:result.note.trim(),status:'dang_vay',repayments:[]};
  const entry={id:crypto.randomUUID(),date:loan.loanDate,type:'expense',kind:'lend',amount:principal,category:'Cho vay',note:loan.note||('Cho vay: '+loan.name),walletId:wallet.id,loanId:loan.id};saveLoanState(loans.concat(loan),tx().concat(entry));
}
async function editLoan(id){
  const loan=loans.find(item=>item.id===id);if(!loan||loan.status==='xoa_no')return;const wallets=allWallets();
  const result=await openSheet({title:'Sửa khoản cho vay',fields:[{name:'name',label:'Tên người vay',value:loan.name,required:true},{name:'principal',label:'Gốc (₫)',type:'money',value:A.formatCanonicalMoney(loan.principal)},{name:'sourceWallet',label:'Ví nguồn',type:'select',value:loan.sourceWallet,options:wallets.map(wallet=>({value:wallet.id,label:wallet.name}))},{name:'loanDate',label:'Ngày cho vay',type:'date',value:loan.loanDate||today()},{name:'dueDate',label:'Hạn trả',type:'date',value:loan.dueDate||''},{name:'rate',label:'Lãi suất (%/năm)',type:'number',value:String(loan.rate||0)},{name:'note',label:'Ghi chú',value:loan.note||''}]});if(!result)return;
  const principal=money(result.principal),linked=tx().filter(transaction=>transaction.kind==='lend'&&transaction.loanId===id),other=linked.slice(1).reduce((sum,transaction)=>sum+money(transaction.amount),0);
  if(principal<Math.max(loanPrincipalCollected(loan),other)){A.toast('Gốc mới không thể thấp hơn số đã thu.');return}
  const updated={...loan,name:result.name.trim()||loan.name,principal,sourceWallet:result.sourceWallet,loanDate:result.loanDate,dueDate:result.dueDate,rate:A.parseQty(result.rate||'0'),note:result.note.trim()};let changed=false;
  const transactions=tx().map(transaction=>{if(transaction.kind!=='lend'||transaction.loanId!==id||changed)return transaction;changed=true;return {...transaction,date:updated.loanDate,amount:principal-other,walletId:updated.sourceWallet,note:updated.note||('Cho vay: '+updated.name)}});
  saveLoanState(loans.map(item=>item.id===id?updated:item),transactions);
}
async function repayLoan(id){
  const loan=loans.find(item=>item.id===id);if(!loan||loan.status==='xoa_no')return;const outstanding=loanOutstanding(loan),wallets=allWallets();
  const result=await openSheet({title:'Thu hồi · '+loan.name,fields:[{name:'principal',label:'Gốc thu (tối đa '+vnd(outstanding)+' ₫)',type:'money',required:true},{name:'interest',label:'Lãi thu (₫)',type:'money',value:'0'},{name:'walletId',label:'Ví nhận',type:'select',options:wallets.map(wallet=>({value:wallet.id,label:wallet.name}))},{name:'date',label:'Ngày thu hồi',type:'date',value:today()},{name:'note',label:'Ghi chú'}]});if(!result)return;
  const principal=money(result.principal),interest=money(result.interest);if(principal>outstanding){A.toast('Gốc thu hồi vượt quá dư nợ còn lại.');return}const repayment={id:crypto.randomUUID(),date:result.date,principal,interest,receiveWallet:result.walletId,note:result.note.trim()},updated={...loan,repayments:(loan.repayments||[]).concat(repayment)},entry={id:repayment.id,date:repayment.date,type:'income',kind:'repay',amount:principal+interest,principalCollected:principal,category:'Thu hồi nợ',note:repayment.note||('Thu hồi: '+loan.name),walletId:repayment.receiveWallet,loanId:id,repaymentId:repayment.id};saveLoanState(loans.map(item=>item.id===id?updated:item),tx().concat(entry));
}
async function editRepayment(loanId,repaymentId){
  const loan=loans.find(item=>item.id===loanId),repayment=loan?.repayments?.find(item=>item.id===repaymentId);if(!loan||!repayment)return;
  const other=loanPrincipalCollected(loan)-money(repayment.principal),wallets=allWallets();
  const result=await openSheet({title:'Sửa lần thu hồi',fields:[{name:'principal',label:'Gốc thu (tối đa '+vnd(money(loan.principal)-other)+' ₫)',type:'money',value:A.formatCanonicalMoney(repayment.principal)},{name:'interest',label:'Lãi thu (₫)',type:'money',value:A.formatCanonicalMoney(repayment.interest)},{name:'walletId',label:'Ví nhận',type:'select',value:repayment.receiveWallet,options:wallets.map(wallet=>({value:wallet.id,label:wallet.name}))},{name:'date',label:'Ngày thu hồi',type:'date',value:repayment.date},{name:'note',label:'Ghi chú',value:repayment.note||''}]});if(!result)return;
  const principal=money(result.principal),interest=money(result.interest);if(principal>money(loan.principal)-other){A.toast('Tổng gốc thu hồi vượt quá số tiền cho vay.');return}
  const updated={...repayment,date:result.date,principal,interest,receiveWallet:result.walletId,note:result.note.trim()},updatedLoan={...loan,repayments:loan.repayments.map(item=>item.id===repaymentId?updated:item)};
  const transactions=tx().map(transaction=>transaction.kind==='repay'&&transaction.repaymentId===repaymentId?{...transaction,date:updated.date,amount:principal+interest,principalCollected:principal,walletId:updated.receiveWallet,note:updated.note||('Thu hồi: '+loan.name)}:transaction);saveLoanState(loans.map(item=>item.id===loanId?updatedLoan:item),transactions);
}
async function deleteRepayment(loanId,repaymentId){const loan=loans.find(item=>item.id===loanId);if(!loan||!await confirmSheet('Xóa lần thu hồi','Ví và dư nợ sẽ được tính lại.'))return;const updated={...loan,repayments:loan.repayments.filter(item=>item.id!==repaymentId)},transactions=tx().filter(transaction=>transaction.kind!=='repay'||transaction.repaymentId!==repaymentId);saveLoanState(loans.map(item=>item.id===loanId?updated:item),transactions)}
async function writeOffLoan(id){const loan=loans.find(item=>item.id===id),outstanding=loan?loanOutstanding(loan):0;if(!loan||outstanding<=0)return;if(!await confirmSheet('Xóa nợ','Xóa phần còn lại '+vnd(outstanding)+' khỏi tổng tài sản?','Xóa nợ'))return;saveLoanState(loans.map(item=>item.id===id?{...item,status:'xoa_no'}:item))}
async function deleteLoan(id){const loan=loans.find(item=>item.id===id);if(!loan||!await confirmSheet('Xóa khoản cho vay','Xóa khoản cho vay và các giao dịch liên kết của '+loan.name+'?'))return;saveLoanState(loans.filter(item=>item.id!==id),tx().filter(transaction=>transaction.loanId!==id))}
function focusLoan(id){
  const panel=$('#loanPanel');
  if(!panel)return;
  document.querySelector('[data-main-tab="investment"]')?.click();
  panel.scrollIntoView({behavior:'smooth',block:'start'});
  const row=Array.from(panel.querySelectorAll('[data-loan-edit]')).find(button=>button.dataset.loanEdit===id)?.closest('tr');
  row?.classList.add('loan-highlight');
  setTimeout(()=>row?.classList.remove('loan-highlight'),1800);
}

function handleLoanAction(event){
  const target=event.target;
  const edit=target.closest('[data-loan-edit]')?.dataset.loanEdit;
  const repay=target.closest('[data-loan-repay]')?.dataset.loanRepay;
  const writeOff=target.closest('[data-loan-writeoff]')?.dataset.loanWriteoff;
  const remove=target.closest('[data-loan-delete]')?.dataset.loanDelete;
  const repaymentEdit=target.closest('[data-repayment-edit]')?.dataset.repaymentEdit;
  const repaymentDelete=target.closest('[data-repayment-delete]')?.dataset.repaymentDelete;
  if(edit)editLoan(edit);
  else if(repay)repayLoan(repay);
  else if(writeOff)writeOffLoan(writeOff);
  else if(remove)deleteLoan(remove);
  else if(repaymentEdit){const [loanId,repaymentId]=repaymentEdit.split('|');editRepayment(loanId,repaymentId);}
  else if(repaymentDelete){const [loanId,repaymentId]=repaymentDelete.split('|');deleteRepayment(loanId,repaymentId);}
}

function legacyLoanTransactions(){
  const oldCategories=['Cho vay','Hóa đơn điện, nước, phí dịch vụ'];
  return tx().filter(transaction=>!transaction.loanMigrationHandled&&!transaction.kind&&(
    (transaction.type==='expense'&&oldCategories.includes(transaction.category))||
    (transaction.type==='income'&&transaction.category==='Nhận hoàn trả tiền cho vay')
  )).sort((left,right)=>(left.date||'').localeCompare(right.date||''));
}

function runLoanMigration(){
  const pending=legacyLoanTransactions();
  if(!pending.length)return;
  const overlay=document.createElement('div');
  overlay.className='modal open loan-migration-modal';
  overlay.innerHTML='<div class="dialog loan-migration-dialog"><div class="panel-head"><div><h2>Kiểm tra giao dịch cho vay cũ</h2><p class="note">App không tự đoán. Chọn xử lý cho từng giao dịch; có thể bỏ qua và quyết định lần sau.</p></div></div><div class="loan-migration-list">'+pending.map(transaction=>{
    const isLend=transaction.type==='expense';
    const loanOptions=loans.map(loan=>'<option value="'+A.esc(loan.id)+'">'+A.esc(loan.name)+' · còn '+vnd(loanOutstanding(loan))+'</option>').join('');
    return '<article class="loan-migration-item" data-migration-item="'+A.esc(transaction.id)+'"><strong>'+A.esc(transaction.date||'—')+' · '+A.esc(transaction.category)+' · '+vnd(transaction.amount)+'</strong><p>'+A.esc(transaction.note||'')+' · '+A.esc(walletName(transaction.walletId))+'</p><label>Cách xử lý<select data-migration-choice><option value="skip">Chọn sau</option><option value="new">Chuyển thành khoản cho vay mới</option><option value="existing">Gắn vào khoản cho vay có sẵn</option><option value="keep">Giữ nguyên là '+(isLend?'chi':'thu')+' thường</option></select></label><label class="migration-new" hidden>Tên người vay<input data-borrower type="text"></label><label class="migration-date" hidden>Ngày cho vay<input data-loan-date type="date" value="'+A.esc(transaction.date||today())+'"></label><label class="migration-existing" hidden>Khoản vay<select data-loan-select><option value="">Chọn khoản vay</option>'+loanOptions+'</select></label>'+(!isLend?'<label class="migration-principal" hidden>Phần gốc thu hồi (nhập rõ, không tự đoán)<input data-collected-principal type="text" inputmode="decimal"></label>':'')+'</article>';
  }).join('')+'</div><div class="form-actions"><button class="btn" data-migration-skip>Bỏ qua lần này</button><button class="btn primary" data-migration-save>Lưu lựa chọn</button></div></div>';
  document.body.append(overlay);
  overlay.addEventListener('change',event=>{
    const select=event.target.closest('[data-migration-choice]');
    if(!select)return;
    const item=select.closest('[data-migration-item]');
    const choice=select.value;
    item.querySelector('.migration-new').hidden=choice!=='new';
    item.querySelector('.migration-date').hidden=choice!=='new';
    item.querySelector('.migration-existing').hidden=choice!=='existing';
    const principal=item.querySelector('.migration-principal');
    if(principal)principal.hidden=choice==='skip'||choice==='keep';
  });
  overlay.querySelector('[data-migration-skip]').onclick=()=>overlay.remove();
  overlay.querySelector('[data-migration-save]').onclick=()=>{
    const updatedLoans=loans.map(loan=>({...loan,repayments:[...(loan.repayments||[])]}));
    const updatedTransactions=tx().map(transaction=>({...transaction}));
    for(const item of overlay.querySelectorAll('[data-migration-item]')){
      const id=item.dataset.migrationItem;
      const transaction=updatedTransactions.find(entry=>entry.id===id);
      const choice=item.querySelector('[data-migration-choice]').value;
      if(!transaction||choice==='skip')continue;
      if(choice==='keep'){transaction.loanMigrationHandled=true;continue;}
      const isLend=transaction.type==='expense';
      let loan=null;
      if(choice==='new'){
        const name=item.querySelector('[data-borrower]').value.trim();
        if(!name){A.toast('Nhập tên người vay cho giao dịch đã chọn.');return;}
        loan={id:crypto.randomUUID(),name,principal:isLend?money(transaction.amount):0,loanDate:item.querySelector('[data-loan-date]').value||transaction.date,sourceWallet:isLend?transaction.walletId:'',dueDate:'',rate:0,note:'Chuyển từ giao dịch cũ',status:'dang_vay',repayments:[]};
        if(!isLend){
          const principalInput=item.querySelector('[data-collected-principal]');
          const principalText=principalInput?.value.trim()||'';
          if(!principalText){A.toast('Nhập phần gốc thu hồi để phân loại giao dịch cũ.');return;}
          const collected=money(principalText);
          if(collected>money(transaction.amount)){A.toast('Gốc thu hồi không thể lớn hơn tổng tiền thu.');return;}
          loan.principal=collected;
        }
        updatedLoans.push(loan);
      }else{
        const loanId=item.querySelector('[data-loan-select]').value;
        loan=updatedLoans.find(entry=>entry.id===loanId);
        if(!loan||loan.status==='xoa_no'){A.toast('Chọn khoản cho vay đang còn hiệu lực.');return;}
      }
      if(isLend){
        if(choice==='existing'){
          loan.principal=money(loan.principal)+money(transaction.amount);
          if(!loan.loanDate||transaction.date<loan.loanDate)loan.loanDate=transaction.date;
        }
        transaction.kind='lend';
        transaction.loanId=loan.id;
      }else{
        const principalInput=item.querySelector('[data-collected-principal]');
        const principalText=principalInput?.value.trim()||'';
        if(!principalText){A.toast('Nhập phần gốc thu hồi để phân loại giao dịch cũ.');return;}
        const collected=money(principalText);
        if(choice==='new')loan.principal=collected;
        if(collected>loanOutstanding(loan)){A.toast('Gốc thu hồi vượt quá dư nợ khoản vay đã chọn.');return;}
        const repayment={id:transaction.id,date:transaction.date,principal:collected,interest:money(transaction.amount)-collected,receiveWallet:transaction.walletId,note:transaction.note||''};
        loan.repayments=(loan.repayments||[]).concat(repayment);
        transaction.kind='repay';
        transaction.loanId=loan.id;
        transaction.repaymentId=repayment.id;
        transaction.principalCollected=collected;
        transaction.category='Thu hồi nợ';
      }
      transaction.loanMigrationHandled=true;
      refreshLoanStatus(loan);
    }
    loans=updatedLoans;
    write(LOAN_KEY,loans);
    write(A.transactionKey,JSON.stringify(updatedTransactions));
    A.setTransactions(updatedTransactions);
    overlay.remove();
    renderAll();
    if(!legacyLoanTransactions().length)localStorage.setItem('so-dau-tu-loan-migration-v1','done');
  };
}

function renderWallets(){
  const host=$('#walletPanel');if(!host)return;
  const wallets=allWallets(true).map(wallet=>({...wallet,item:assets().find(item=>item.id===wallet.assetId)}));
  host.innerHTML='<h3>Ví</h3><div class="wallet-setting"><label><input type="checkbox" id="blockOverdraft" '+(localStorage.getItem('so-dau-tu-block-overdraft')==='1'?'checked':'')+'> Chặn chi vượt số dư</label></div><button class="btn" id="addWallet">＋ Thêm ví</button>'+(wallets.length?wallets.map(wallet=>'<div class="wallet-row"><div><strong>'+A.esc(wallet.name)+'</strong><small>'+walletTypeName(wallet.type)+(wallet.item?.hidden?' · Đã ẩn':'')+'</small></div><strong class="'+(wallet.balance<0?'wallet-negative':'')+'">'+vnd(wallet.balance)+(wallet.balance<0?' · Ví đang âm':'')+'</strong><div class="wallet-actions"><button class="btn" data-wallet-edit="'+wallet.assetId+'">Sửa</button><button class="btn" data-wallet-check="'+wallet.assetId+'">Kiểm tra khớp số dư</button><button class="btn" data-wallet-hide="'+wallet.assetId+'">'+(wallet.item?.hidden?'Hiện':'Ẩn')+'</button></div></div>').join(''):'<p class="note">Chưa có ví.</p>');
  $('#blockOverdraft').onchange=event=>localStorage.setItem('so-dau-tu-block-overdraft',event.target.checked?'1':'0');
  $('#addWallet').onclick=async()=>{const result=await openSheet({title:'Thêm ví',fields:[{name:'name',label:'Tên ví',required:true},{name:'type',label:'Loại ví',type:'select',options:[{value:'cash',label:'Tiền mặt'},{value:'bank',label:'Ngân hàng'},{value:'ewallet',label:'Ví điện tử'},{value:'saving',label:'Sổ tiết kiệm'}]},{name:'balance',label:'Số dư đầu kỳ (₫)',type:'money',value:'0'}]});if(!result)return;const amount=money(result.balance);A.updateItems(list=>list.concat({id:crypto.randomUUID(),name:result.name.trim(),type:result.type,amount,openingBalance:amount}));renderAll()};
  host.onclick=async event=>{
    const edit=event.target.closest('[data-wallet-edit]')?.dataset.walletEdit,hide=event.target.closest('[data-wallet-hide]')?.dataset.walletHide,check=event.target.closest('[data-wallet-check]')?.dataset.walletCheck;
    if(edit){const wallet=assets().find(item=>item.id===edit);if(!wallet)return;const result=await openSheet({title:'Sửa ví',fields:[{name:'name',label:'Tên ví',value:wallet.name},{name:'type',label:'Loại ví',type:'select',value:wallet.type,options:[{value:'cash',label:'Tiền mặt'},{value:'bank',label:'Ngân hàng'},{value:'ewallet',label:'Ví điện tử'},{value:'saving',label:'Sổ tiết kiệm'}]}]});if(!result)return;A.updateItems(list=>list.map(item=>item.id===edit?{...item,name:result.name.trim()||item.name,type:result.type}:item));renderAll();return}
    if(hide){A.updateItems(list=>list.map(item=>item.id===hide?{...item,hidden:!item.hidden}:item));renderAll();return}
    if(check){const wallet=assets().find(item=>item.id===check);if(!wallet)return;const actual=await openSheet({title:'Kiểm tra khớp số dư · '+wallet.name,fields:[{name:'balance',label:'Số dư thực tế (₫)',type:'money',value:A.formatCanonicalMoney(walletBalance(wallet))}]});if(!actual)return;const delta=signedMoney(actual.balance)-walletBalance(wallet);if(!delta){A.toast('Số dư đã khớp');return}if(!await confirmSheet('Điều chỉnh số dư','Chênh lệch '+vnd(delta)+'. Tạo giao dịch điều chỉnh?','Tạo điều chỉnh'))return;saveTx(tx().concat({id:crypto.randomUUID(),date:today(),type:'adjust',kind:'adjust',amount:delta,walletId:walletIdFor(wallet),note:'Điều chỉnh số dư'}));renderAll()}
  };
}
function applyTheme(){const mode=localStorage.getItem('so-dau-tu-theme')||(localStorage.getItem(K.dark)==='1'?'dark':'auto');const dark=mode==='dark'||(mode==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark)}
function renderSettings(){const content=$('#settingsContent'),walletPanel=$('#walletPanel');if(!content)return;content.innerHTML='<section class="settings-card"><h3>Dữ liệu</h3><div class="settings-actions"><button class="btn" id="settingsExportJson">Xuất JSON</button><button class="btn" id="settingsImportJson">Nhập JSON</button><button class="btn" id="settingsExportCsv">Xuất CSV</button></div></section><section class="settings-card"><h3>Danh mục và ví</h3><div class="settings-actions"><button class="btn" id="settingsCategories">Danh mục</button><button class="btn" id="settingsWallets">Ví</button></div><div id="settingsWalletHost"></div></section><section class="settings-card"><h3>Giao diện và riêng tư</h3><label class="field"><span>Chế độ màu</span><select id="themeMode"><option value="auto">Tự động theo máy</option><option value="light">Sáng</option><option value="dark">Tối</option></select></label><label class="settings-check"><input type="checkbox" id="settingsHideBalances"> Ẩn số dư</label><button class="btn" id="settingsPin">Khóa màn hình (PIN)</button><p class="note">Khóa màn hình chỉ che màn hình, không mã hóa dữ liệu.</p></section><section class="settings-card"><h3>Cách tính</h3><label class="settings-check"><input type="checkbox" id="settingsLoanFlows"> Tính cả cho vay/thu hồi gốc vào tổng thu chi</label><button class="btn" id="settingsDefaultBudget">Ngân sách mặc định</button></section>';if(walletPanel)$('#settingsWalletHost').append(walletPanel);$('#themeMode').value=localStorage.getItem('so-dau-tu-theme')||'auto';$('#settingsHideBalances').checked=localStorage.getItem(K.hide)==='1';$('#settingsLoanFlows').checked=loanCashflowSwitch();$('#settingsExportJson').onclick=exportFullJson;$('#settingsImportJson').onclick=importFullJson;$('#settingsExportCsv').onclick=exportCsv;$('#settingsCategories').onclick=manageCategories;$('#settingsWallets').onclick=()=>{walletPanel.hidden=!walletPanel.hidden;renderWallets()};$('#settingsPin').onclick=setupPin;$('#settingsDefaultBudget').onclick=setDefaultBudget;$('#themeMode').onchange=event=>{localStorage.setItem('so-dau-tu-theme',event.target.value);applyTheme()};$('#settingsHideBalances').onchange=event=>{const hidden=event.target.checked;localStorage.setItem(K.hide,hidden?'1':'0');document.documentElement.classList.toggle('hide-balances',hidden);renderAll()};$('#settingsLoanFlows').onchange=event=>{localStorage.setItem('so-dau-tu-count-lend-repay',event.target.checked?'1':'0');renderAll()}}
let previousView='investment';function openSettings(){previousView=document.querySelector('[data-main-tab="cashflow"].active')?'cashflow':'investment';$('#investmentView').hidden=true;$('#cashflowView').hidden=true;$('#settingsScreen').hidden=false;renderSettings();window.scrollTo({top:0,behavior:'smooth'})}function closeSettings(){$('#settingsScreen').hidden=true;$('#investmentView').hidden=previousView!=='investment';$('#cashflowView').hidden=previousView!=='cashflow'}
function installQuickEntry(){$('#openSettings').onclick=openSettings;$('#closeSettings').onclick=closeSettings;$('#hideBalancesQuick').onclick=()=>{const hidden=!document.documentElement.classList.contains('hide-balances');document.documentElement.classList.toggle('hide-balances',hidden);localStorage.setItem(K.hide,hidden?'1':'0');renderAll()};}
async function openQuickEntry(){const wallets=allWallets();if(!wallets.length){A.toast('Chưa có ví để ghi giao dịch');return}let kind='expense',categoryId='';const recent=localStorage.getItem('so-dau-tu-recent-wallet'),notes=Array.from(new Set(tx().map(item=>item.note).filter(Boolean))).slice(-6).reverse();const result=await openSheet({title:'Thêm nhanh',submit:'Lưu giao dịch',fields:[{name:'amount',label:'Số tiền (₫)',type:'money',required:true},{name:'date',label:'Ngày',type:'date',value:today()},{name:'walletId',label:'Ví',type:'select',value:wallets.some(wallet=>wallet.id===recent)?recent:wallets[0].id,options:wallets.map(wallet=>({value:wallet.id,label:wallet.name}))},{name:'note',label:'Ghi chú'}],render:form=>{const area=document.createElement('div');area.className='quick-category-area';const types=document.createElement('div');types.className='quick-type-buttons';const categories=document.createElement('div');categories.className='quick-category-buttons';function draw(){types.innerHTML='';[['expense','Chi'],['income','Thu']].forEach(([value,label])=>{const button=document.createElement('button');button.type='button';button.className='btn '+(kind===value?'primary':'');button.textContent=label;button.onclick=()=>{kind=value;categoryId='';draw()};types.append(button)});categories.innerHTML='';categoryRecords.filter(record=>record.type===(kind==='income'?'income':'expense')&&!record.hidden).forEach(record=>{const button=document.createElement('button');button.type='button';button.className='category-chip '+(categoryId===record.id?'selected':'');button.textContent=record.name;button.onclick=()=>{categoryId=record.id;draw()};categories.append(button)})}draw();area.append(types,categories);notes.forEach(note=>{const button=document.createElement('button');button.type='button';button.className='note-suggestion';button.textContent=note;button.onclick=()=>form.elements.note.value=note;area.append(button)});form.append(area)}});if(!result)return;const category=categoryRecords.find(record=>record.id===categoryId&&record.type===(kind==='income'?'income':'expense')),amount=money(result.amount),wallet=wallets.find(item=>item.id===result.walletId);if(!category||!wallet||amount<=0){A.toast('Chọn danh mục và nhập số tiền');return}saveTx(tx().concat({id:crypto.randomUUID(),date:result.date||today(),type:kind,amount,category:category.name,categoryId:category.id,walletId:wallet.id,note:result.note.trim()}));localStorage.setItem('so-dau-tu-recent-wallet',wallet.id);renderAll();A.toast('Đã lưu giao dịch')}
function recordDeleteUndo(message,record,undo){const host=$('#toast');host.innerHTML='';const text=document.createElement('span');text.textContent=message;const button=document.createElement('button');button.className='toast-undo';button.textContent='Hoàn tác';button.onclick=()=>{undo();host.classList.remove('show')};host.append(text,button);host.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>host.classList.remove('show'),5000)}
function installBackgroundLock(){let hiddenAt=0;document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();return}if(hiddenAt&&Date.now()-hiddenAt>=60000&&localStorage.getItem(K.pin))pinOverlay();hiddenAt=0});const media=matchMedia('(prefers-color-scheme: dark)');media.addEventListener?.('change',()=>{if((localStorage.getItem('so-dau-tu-theme')||'auto')==='auto')applyTheme()})}

function init(){backupBeforeLoanMigration();if(!cat.income.includes('Thu hồi nợ')){cat.income.push('Thu hồi nợ');write(K.cats,cat)}window.__ledgerAPI={walletBalance,debtBalance};window.__loanAPI={totalOutstanding:loanTotalOutstanding,cashflowAmount,openLoan:focusLoan};migrateLedger();if(localStorage.getItem('so-dau-tu-ledger-orphans')){A.toast('Đã chuyển giao dịch không tìm thấy ví vào Ví chưa xác định; các giao dịch được giữ lại.');localStorage.removeItem('so-dau-tu-ledger-orphans')}injectCashflowPanels();injectLoanPanel();renderLoanPanel();runLoanMigration();applyTheme();if(localStorage.getItem(K.hide)==='1')document.documentElement.classList.add('hide-balances');initTransactionExtras();installQuickEntry();renderAll();renderSettings();installBackgroundLock();pinOverlay();if('serviceWorker' in navigator&&location.protocol!=='file:'){navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='UPDATE_AVAILABLE')A.toast('Có bản mới, tải lại trang để cập nhật')});navigator.serviceWorker.register('./sw.js').catch(()=>{})}maybeSnapshot()}
function maybeSnapshot(){if(!snaps.some(x=>x.month===today().slice(0,7)))saveSnapshot()}
init();
})();

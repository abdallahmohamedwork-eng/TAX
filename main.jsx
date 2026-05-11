import React, {useEffect, useMemo, useRef, useState} from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import './style.css';

const VAT_RATE = 0.14;
const BRANDS = ['GLORY', 'ROLAND', 'VOY'];
const PARTIES = ['محمد رجائي', 'مصطفى رجائي'];
const now = new Date();
const thisYear = now.getFullYear();
const thisMonth = now.getMonth() + 1;
const monthsLeft = Math.max(1, 12 - thisMonth + 1);
const initialState = {
  targets: [],
  products: [],
  invoices: [],
  parties: PARTIES.map(name => ({name, taxCard: '', notes: ''})),
  attachments: []
};

function uid(){return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())}
function money(n){return Number(n||0).toLocaleString('ar-EG', {maximumFractionDigits:2})}
function toNum(v){return Number(String(v||0).replace(/,/g,'')) || 0}
function invoiceNo(brand){const d=new Date();return `${brand}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}-${String(Math.floor(Math.random()*999)+1).padStart(3,'0')}`}
function purchaseFromSales(s){return toNum(s)*110/120}
function salesFromPurchase(p){return toNum(p)*120/110}
function sum(arr, field){return arr.reduce((a,b)=>a+toNum(b[field]),0)}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function App(){
  const [state,setState] = useState(initialState);
  const [tab,setTab] = useState('dashboard');
  const [syncMsg,setSyncMsg] = useState('');
  const [selectedInvoice,setSelectedInvoice] = useState(null);

  useEffect(()=>{
    const saved = localStorage.getItem('tax-system-state');
    if(saved) setState(JSON.parse(saved));
    if(supabase) loadCloud();
  },[]);

  useEffect(()=>{localStorage.setItem('tax-system-state', JSON.stringify(state));},[state]);

  async function loadCloud(){
    const {data,error} = await supabase.from('app_state').select('data').eq('id',1).single();
    if(!error && data?.data && Object.keys(data.data).length) {setState({...initialState, ...data.data}); setSyncMsg('تم تحميل البيانات من Supabase');}
  }
  async function saveCloud(){
    if(!supabase){setSyncMsg('لم يتم ربط Supabase. التطبيق يحفظ محليًا فقط.'); return;}
    const {error}=await supabase.from('app_state').upsert({id:1,data:state,updated_at:new Date().toISOString()});
    setSyncMsg(error ? 'فشل الحفظ على Supabase' : 'تم الحفظ على Supabase بنجاح');
  }

  function updateState(patch){setState(s=>({...s,...patch}))}
  function addOrUpdateTarget(row){
    setState(s=>{
      const existing = s.targets.find(x=>x.id===row.id);
      const targets = existing ? s.targets.map(x=>x.id===row.id?row:x) : [row, ...s.targets];
      return {...s, targets};
    })
  }
  function saveParty(party){setState(s=>({...s, parties:s.parties.map(p=>p.name===party.name?party:p)}))}
  function saveProduct(product){setState(s=>({...s, products: product.id ? s.products.map(p=>p.id===product.id?product:p) : [{...product,id:uid()},...s.products]}))}
  function deleteProduct(id){setState(s=>({...s, products:s.products.filter(p=>p.id!==id)}))}
  function saveInvoice(inv){setState(s=>({...s, invoices:[inv,...s.invoices]})); setSelectedInvoice(inv); setTab('invoiceView')}

  const nav = [
    ['dashboard','الرئيسية'],['glory','GLORY TAX'],['roland','ROLAND TAX'],['voy','VOY TAX'],['products','الأصناف'],['parties','البطاقات الضريبية'],['invoices','الفواتير']
  ];
  return <div className="app">
    <aside>
      <h2>Tax System</h2>
      <p className="muted">VOY / GLORY / ROLAND</p>
      {nav.map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}</button>)}
      <button onClick={saveCloud}>حفظ على Supabase</button>
      <button onClick={()=>exportBackup(state)}>نسخة احتياطية JSON</button>
      <label className="uploadBtn">استيراد Backup<input type="file" accept=".json" onChange={e=>importBackup(e,setState)} /></label>
      <p className="tiny">{syncMsg}</p>
    </aside>
    <main>
      {tab==='dashboard' && <Dashboard state={state} setTab={setTab}/>}      
      {tab==='glory' && <TaxBrand brand="GLORY" state={state} addOrUpdateTarget={addOrUpdateTarget}/>}      
      {tab==='roland' && <TaxBrand brand="ROLAND" state={state} addOrUpdateTarget={addOrUpdateTarget} allowInvoice saveInvoice={saveInvoice}/>}      
      {tab==='voy' && <VoyTax state={state} addOrUpdateTarget={addOrUpdateTarget} saveInvoice={saveInvoice}/>}      
      {tab==='products' && <Products state={state} saveProduct={saveProduct} deleteProduct={deleteProduct}/>}      
      {tab==='parties' && <Parties state={state} saveParty={saveParty}/>}      
      {tab==='invoices' && <Invoices state={state} setSelectedInvoice={setSelectedInvoice} setTab={setTab}/>}      
      {tab==='invoiceView' && <InvoiceView invoice={selectedInvoice} parties={state.parties}/>}      
    </main>
  </div>
}

function Dashboard({state,setTab}){
  const cards = BRANDS.map(brand=>{
    const rows = state.targets.filter(t=>t.brand===brand && toNum(t.year)===thisYear);
    return {brand, sales:sum(rows,'salesTarget'), purchase:sum(rows,'purchaseTarget'), actualSales:sum(rows,'actualSales'), actualPurchase:sum(rows,'actualPurchase'), invoices:state.invoices.filter(i=>i.brand===brand).length};
  });
  return <section><Header title="لوحة التحكم" subtitle="ملخص سنوي وشهري للبراندات" />
    <div className="grid3">{cards.map(c=><div className="card" key={c.brand} onClick={()=>setTab(c.brand.toLowerCase())}>
      <h3>{c.brand}</h3><Kpi label="هدف البيع" val={money(c.sales)} /><Kpi label="هدف المشتريات" val={money(c.purchase)} />
      <Kpi label="البيع الفعلي" val={money(c.actualSales)} /><Kpi label="المشتريات الفعلية" val={money(c.actualPurchase)} />
      <Kpi label="عدد الفواتير" val={c.invoices} />
    </div>)}</div>
  </section>
}
function Header({title,subtitle}){return <><h1>{title}</h1><p className="muted">{subtitle}</p></>}
function Kpi({label,val}){return <div className="kpi"><span>{label}</span><b>{val}</b></div>}

function TaxBrand({brand,state,addOrUpdateTarget,allowInvoice,saveInvoice}){
  const [form,setForm]=useState({id:'',brand,year:thisYear,month:thisMonth,salesTarget:'',purchaseTarget:'',actualSales:'',actualPurchase:'',notes:''});
  const rows=state.targets.filter(t=>t.brand===brand);
  function change(field,value){
    const f={...form,[field]:value};
    if(field==='salesTarget') f.purchaseTarget = purchaseFromSales(value).toFixed(2);
    if(field==='purchaseTarget') f.salesTarget = salesFromPurchase(value).toFixed(2);
    setForm(f);
  }
  const remainingSales=toNum(form.salesTarget)-toNum(form.actualSales);
  const avg=remainingSales/monthsLeft;
  function save(){addOrUpdateTarget({...form, remainingSales, remainingPurchase:toNum(form.purchaseTarget)-toNum(form.actualPurchase), monthlyAvg:avg, id:form.id||uid()}); setForm({...form,id:''})}
  return <section><Header title={`${brand} TAX`} subtitle="تعديل البيع أو المشتريات يحافظ على علاقة 110/120 تلقائيًا" />
    <div className="card formGrid">
      <Input label="السنة" value={form.year} onChange={v=>setForm({...form,year:v})}/><Input label="الشهر" value={form.month} onChange={v=>setForm({...form,month:v})}/>
      <Input label="هدف البيع" value={form.salesTarget} onChange={v=>change('salesTarget',v)}/><Input label="هدف المشتريات" value={form.purchaseTarget} onChange={v=>change('purchaseTarget',v)}/>
      <Input label="البيع الفعلي" value={form.actualSales} onChange={v=>setForm({...form,actualSales:v})}/><Input label="المشتريات الفعلية" value={form.actualPurchase} onChange={v=>setForm({...form,actualPurchase:v})}/>
      <Input label="ملاحظات" value={form.notes} onChange={v=>setForm({...form,notes:v})}/>
      <Kpi label="متوسط البيع الشهري المطلوب" val={money(avg)} />
      <button className="primary" onClick={save}>حفظ</button>{allowInvoice && <button onClick={()=>{}}>يمكن إنشاء الفاتورة من شاشة الفواتير</button>}
    </div>
    <TargetTable rows={rows} setForm={setForm} exportName={brand}/>
  </section>
}

function VoyTax({state,addOrUpdateTarget,saveInvoice}){
  const [form,setForm]=useState({id:'',brand:'VOY',party:PARTIES[0],year:thisYear,month:thisMonth,purchaseTarget:'',actualPurchase:'',actualSales:'',notes:''});
  const rows=state.targets.filter(t=>t.brand==='VOY');
  function save(){addOrUpdateTarget({...form,id:form.id||uid(), remainingPurchase:toNum(form.purchaseTarget)-toNum(form.actualPurchase)});setForm({...form,id:''})}
  return <section><Header title="VOY TAX" subtitle="في VOY يتم إدخال هدف الشراء مباشرة بدون علاقة 110/120" />
    <div className="card formGrid"><Select label="الشركة" value={form.party} options={PARTIES} onChange={v=>setForm({...form,party:v})}/><Input label="السنة" value={form.year} onChange={v=>setForm({...form,year:v})}/><Input label="الشهر" value={form.month} onChange={v=>setForm({...form,month:v})}/><Input label="هدف الشراء" value={form.purchaseTarget} onChange={v=>setForm({...form,purchaseTarget:v})}/><Input label="الشراء الفعلي" value={form.actualPurchase} onChange={v=>setForm({...form,actualPurchase:v})}/><Input label="البيع الفعلي" value={form.actualSales} onChange={v=>setForm({...form,actualSales:v})}/><Input label="ملاحظات" value={form.notes} onChange={v=>setForm({...form,notes:v})}/><button className="primary" onClick={save}>حفظ</button></div>
    <TargetTable rows={rows} setForm={setForm} exportName="VOY" />
  </section>
}

function TargetTable({rows,setForm,exportName}){return <div className="card"><div className="row"><h3>السجلات</h3><button onClick={()=>exportTargetsExcel(rows, exportName)}>تصدير Excel</button></div><table><thead><tr><th>براند</th><th>الشركة</th><th>شهر/سنة</th><th>هدف البيع</th><th>هدف المشتريات</th><th>متوسط شهري</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.brand}</td><td>{r.party||'-'}</td><td>{r.month}/{r.year}</td><td>{money(r.salesTarget)}</td><td>{money(r.purchaseTarget)}</td><td>{money(r.monthlyAvg)}</td><td><button onClick={()=>setForm(r)}>تعديل</button></td></tr>)}</tbody></table></div>}
function Input({label,value,onChange,type='text'}){return <label><span>{label}</span><input type={type} value={value||''} onChange={e=>onChange(e.target.value)} /></label>}
function Select({label,value,onChange,options}){return <label><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o}>{o}</option>)}</select></label>}

function Products({state,saveProduct,deleteProduct}){
 const [p,setP]=useState({brand:'ROLAND',name:'',sku:'',unitPrice:'',unit:'قطعة'});
 return <section><Header title="إدارة الأصناف" subtitle="الأصناف المستخدمة في فواتير ROLAND و VOY"/><div className="card formGrid"><Select label="البراند" value={p.brand} options={['ROLAND','VOY','GLORY']} onChange={v=>setP({...p,brand:v})}/><Input label="كود الصنف" value={p.sku} onChange={v=>setP({...p,sku:v})}/><Input label="اسم الصنف" value={p.name} onChange={v=>setP({...p,name:v})}/><Input label="سعر الوحدة قبل الضريبة" value={p.unitPrice} onChange={v=>setP({...p,unitPrice:v})}/><Input label="الوحدة" value={p.unit} onChange={v=>setP({...p,unit:v})}/><button className="primary" onClick={()=>{saveProduct(p);setP({brand:'ROLAND',name:'',sku:'',unitPrice:'',unit:'قطعة'})}}>حفظ الصنف</button></div><div className="card"><table><thead><tr><th>براند</th><th>كود</th><th>الصنف</th><th>السعر</th><th>الوحدة</th><th></th></tr></thead><tbody>{state.products.map(x=><tr key={x.id}><td>{x.brand}</td><td>{x.sku}</td><td>{x.name}</td><td>{money(x.unitPrice)}</td><td>{x.unit}</td><td><button onClick={()=>setP(x)}>تعديل</button><button onClick={()=>deleteProduct(x.id)}>حذف</button></td></tr>)}</tbody></table></div></section>
}

function Parties({state,saveParty}){return <section><Header title="البطاقات الضريبية" subtitle="ارفع صورة البطاقة الضريبية لمحمد رجائي ومصطفى رجائي"/>{state.parties.map(p=><PartyCard key={p.name} party={p} saveParty={saveParty}/>)}</section>}
function PartyCard({party,saveParty}){const [p,setP]=useState(party);return <div className="card formGrid"><h3>{p.name}</h3><File label="صورة البطاقة الضريبية" onFile={data=>setP({...p,taxCard:data})}/>{p.taxCard && <img className="thumb" src={p.taxCard}/>}<Input label="ملاحظات" value={p.notes} onChange={v=>setP({...p,notes:v})}/><button className="primary" onClick={()=>saveParty(p)}>حفظ</button></div>}
function File({label,onFile}){return <label><span>{label}</span><input type="file" accept="image/*,.pdf" onChange={async e=>{const f=e.target.files[0]; if(f) onFile(await readFile(f))}}/></label>}
function readFile(file){return new Promise(res=>{const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file)})}

function Invoices({state,setSelectedInvoice,setTab}){return <section><Header title="الفواتير" subtitle="إنشاء وتصدير فواتير PDF و Excel"/><InvoiceCreator state={state} onSave={(inv)=>{setSelectedInvoice(inv);setTab('invoiceView')}}/><div className="card"><h3>الأرشيف</h3><table><thead><tr><th>رقم</th><th>براند</th><th>الشركة</th><th>نوع</th><th>الإجمالي</th><th></th></tr></thead><tbody>{state.invoices.map(i=><tr key={i.id}><td>{i.number}</td><td>{i.brand}</td><td>{i.party}</td><td>{i.type}</td><td>{money(i.total)}</td><td><button onClick={()=>{setSelectedInvoice(i);setTab('invoiceView')}}>فتح</button></td></tr>)}</tbody></table></div></section>}
function InvoiceCreator({state,onSave}){
 const [inv,setInv]=useState({brand:'ROLAND',party:PARTIES[0],type:'بيع',items:[],attachments:[]});
 const [item,setItem]=useState({name:'',quantity:1,unitPrice:''});
 const products=state.products.filter(p=>p.brand===inv.brand);
 const subtotal=inv.items.reduce((a,b)=>a+toNum(b.quantity)*toNum(b.unitPrice),0), vat=subtotal*VAT_RATE, total=subtotal+vat;
 function addItem(){if(!item.name)return; setInv({...inv,items:[...inv.items,{...item,id:uid()}]}); setItem({name:'',quantity:1,unitPrice:''})}
 function chooseProduct(id){const p=products.find(x=>x.id===id); if(p)setItem({name:p.name,quantity:1,unitPrice:p.unitPrice})}
 function save(){onSave({...inv,id:uid(),number:invoiceNo(inv.brand),date:new Date().toISOString().slice(0,10),subtotal,vat,total})}
 return <div className="card"><h3>إنشاء فاتورة</h3><div className="formGrid"><Select label="البراند" value={inv.brand} options={BRANDS} onChange={v=>setInv({...inv,brand:v,items:[]})}/><Select label="الطرف" value={inv.party} options={PARTIES} onChange={v=>setInv({...inv,party:v})}/><Select label="نوع الفاتورة" value={inv.type} options={['بيع','شراء']} onChange={v=>setInv({...inv,type:v})}/><File label="رفع صورة مرفقة للفاتورة" onFile={data=>setInv({...inv,attachments:[...(inv.attachments||[]),data]})}/></div><div className="line"><select onChange={e=>chooseProduct(e.target.value)}><option>اختار صنف محفوظ</option>{products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select><input placeholder="الصنف" value={item.name} onChange={e=>setItem({...item,name:e.target.value})}/><input placeholder="الكمية" value={item.quantity} onChange={e=>setItem({...item,quantity:e.target.value})}/><input placeholder="سعر الوحدة" value={item.unitPrice} onChange={e=>setItem({...item,unitPrice:e.target.value})}/><button onClick={addItem}>إضافة</button></div><table><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>{inv.items.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.quantity}</td><td>{money(x.unitPrice)}</td><td>{money(toNum(x.quantity)*toNum(x.unitPrice))}</td></tr>)}</tbody></table><div className="totals"><Kpi label="الإجمالي قبل الضريبة" val={money(subtotal)}/><Kpi label="ضريبة 14%" val={money(vat)}/><Kpi label="الإجمالي بعد الضريبة" val={money(total)}/></div><button className="primary" onClick={save}>حفظ وفتح الفاتورة</button></div>
}

function InvoiceView({invoice,parties}){const ref=useRef(null); if(!invoice) return <p>لا توجد فاتورة مختارة</p>; const party=parties.find(p=>p.name===invoice.party);return <section><div className="row"><h1>فاتورة {invoice.type}</h1><button onClick={()=>html2pdf().set({margin:8,filename:`${invoice.number}.pdf`,html2canvas:{scale:2}}).from(ref.current).save()}>تصدير PDF</button><button onClick={()=>exportInvoiceExcel(invoice)}>تصدير Excel</button></div><div className="invoice" ref={ref}><div className="invHeader"><h1>{invoice.brand}</h1>{invoice.brand==='VOY'&&<h2>{invoice.party}</h2>}<p>فاتورة {invoice.type}</p></div><div className="invMeta"><p><b>رقم الفاتورة:</b> {invoice.number}</p><p><b>التاريخ:</b> {invoice.date}</p><p><b>الطرف:</b> {invoice.party}</p></div><table><thead><tr><th>م</th><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>{invoice.items.map((x,i)=><tr key={x.id}><td>{i+1}</td><td>{x.name}</td><td>{x.quantity}</td><td>{money(x.unitPrice)}</td><td>{money(toNum(x.quantity)*toNum(x.unitPrice))}</td></tr>)}</tbody></table><div className="summary"><p>الإجمالي قبل الضريبة: <b>{money(invoice.subtotal)}</b></p><p>ضريبة القيمة المضافة 14%: <b>{money(invoice.vat)}</b></p><p className="grand">الإجمالي بعد الضريبة: <b>{money(invoice.total)}</b></p></div>{party?.taxCard && <div className="pageBreak"><h2>البطاقة الضريبية</h2><img className="taxCard" src={party.taxCard}/></div>}{invoice.attachments?.length>0 && <div className="pageBreak"><h2>مرفقات الفاتورة</h2>{invoice.attachments.map((a,i)=><img key={i} className="taxCard" src={a}/>)}</div>}</div></section>}

function exportTargetsExcel(rows,name){const ws=XLSX.utils.json_to_sheet(rows.map(r=>({'براند':r.brand,'الشركة':r.party||'','السنة':r.year,'الشهر':r.month,'هدف البيع':r.salesTarget,'هدف المشتريات':r.purchaseTarget,'البيع الفعلي':r.actualSales,'المشتريات الفعلية':r.actualPurchase,'متوسط شهري':r.monthlyAvg,'ملاحظات':r.notes})));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,name);XLSX.writeFile(wb,`${name}-tax.xlsx`)}
function exportInvoiceExcel(inv){const data=[['براند',inv.brand],['رقم الفاتورة',inv.number],['الطرف',inv.party],['النوع',inv.type],[],['م','الصنف','الكمية','سعر الوحدة','الإجمالي'],...inv.items.map((x,i)=>[i+1,x.name,x.quantity,x.unitPrice,toNum(x.quantity)*toNum(x.unitPrice)]),[],['الإجمالي قبل الضريبة',inv.subtotal],['ضريبة 14%',inv.vat],['الإجمالي بعد الضريبة',inv.total]];const ws=XLSX.utils.aoa_to_sheet(data);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Invoice');XLSX.writeFile(wb,`${inv.number}.xlsx`)}
function exportBackup(state){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='tax-system-backup.json';a.click()}
function importBackup(e,setState){const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>setState(JSON.parse(r.result)); r.readAsText(f)}

createRoot(document.getElementById('root')).render(<App />);

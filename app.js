const $=s=>document.querySelector(s);
const LEVELS=['Recordar datos y definiciones','Comprender con tus palabras','Aplicar a un caso concreto','Analizar relaciones y causas','Evaluar y razonar con criterio'];
const XP_PER_LEVEL=100;
const ls={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
let lib=ls.get('sb:lib',[]),curId=ls.get('sb:cur',null),cfg=ls.get('sb:cfg',{key:'',model:'gemini-flash-lite-latest'}),turn=null,addTarget=null,cool=null;
if(/claude/i.test(cfg.model||'')||/^sk-ant/.test(cfg.key||'')){cfg={key:'',model:'gemini-flash-lite-latest'};ls.set('sb:cfg',cfg)}
const say=(t,e)=>{const m=$('#msg');m.textContent=t;m.className='msg'+(e?' err':'')};
const save=()=>{if(!(ls.set('sb:lib',lib)&&ls.set('sb:cur',curId)))say('No cabe más material en el navegador: borra algún tema.',true)};
const cur=()=>lib.find(m=>m.id===curId);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const k=Math.floor(Math.random()*(i+1));[a[i],a[k]]=[a[k],a[i]]}return a};

/* ---------- importar archivos ---------- */
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
async function extract(f){
  const ext=f.name.split('.').pop().toLowerCase(),buf=await f.arrayBuffer();
  if(ext==='pdf'){
    const pdf=await pdfjsLib.getDocument({data:buf}).promise;let t='';
    for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i);t+=(await p.getTextContent()).items.map(x=>x.str).join(' ')+'\n'}
    return t;
  }
  if(ext==='docx')return (await mammoth.extractRawText({arrayBuffer:buf})).value;
  if(ext==='pptx'){
    const z=await JSZip.loadAsync(buf);
    const names=Object.keys(z.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>parseInt(a.match(/\d+/)[0])-parseInt(b.match(/\d+/)[0]));
    let t='';for(const n of names){const x=await z.files[n].async('string');t+=[...x.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m=>m[1]).join(' ')+'\n'}
    return t;
  }
  return new TextDecoder().decode(buf);
}
async function addFiles(files,target){
  const parts=[];
  for(const f of files){
    say('Leyendo '+f.name+'…');
    try{const t=(await extract(f)).replace(/[ \t]+/g,' ').trim();if(t.length<80)throw new Error('sin texto (¿PDF escaneado?)');parts.push({name:f.name.replace(/\.[^.]+$/,''),t})}
    catch(err){say('No se pudo leer '+f.name+': '+err.message,true)}
  }
  if(!parts.length)return;
  const block=parts.map(p=>'\n\n=== '+p.name+' ===\n'+p.t).join('');
  if(target){const m=lib.find(x=>x.id===target);if(m){m.text+=block;m.n=(m.n||1)+parts.length;m.used=[];save();render()}}
  else if(parts.length>1&&$('#merge').checked)add(parts[0].name+' +'+(parts.length-1),block.trim(),parts.length);
  else parts.forEach(p=>add(p.name,p.t,1));
  say('Importado correctamente.');
}
$('#file').addEventListener('change',async e=>{await addFiles([...e.target.files],null);e.target.value=''});
$('#file2').addEventListener('change',async e=>{await addFiles([...e.target.files],addTarget);e.target.value=''});
$('#pasteBtn').onclick=()=>{$('#paste').hidden=!$('#paste').hidden};
$('#psave').onclick=()=>{const t=$('#ptext').value.trim();if(t.length<80){say('Pega al menos un párrafo.',true);return}
  add($('#pname').value.trim()||'Apuntes',t,1);$('#ptext').value='';$('#pname').value='';$('#paste').hidden=true;say('Guardado.')};
function add(name,text,n){lib.push({id:Date.now()+Math.random().toString(36).slice(2,6),name,text,n,level:1,xp:0,streak:0,asked:[],used:[]});curId=lib[lib.length-1].id;save();render()}

/* ---------- biblioteca ---------- */
function render(){
  const ul=$('#list');ul.innerHTML='';
  lib.forEach(m=>{
    const li=document.createElement('li');if(m.id===curId)li.className='on';
    const d=document.createElement('div');d.innerHTML='<b></b><small></small>';
    d.querySelector('b').textContent=m.name;d.querySelector('small').textContent='Nivel '+m.level+' · '+m.xp+' pts · '+(m.n||1)+' archivo'+((m.n||1)>1?'s':'')+' · '+Math.round(m.text.length/1000)+'k caracteres';
    const r=document.createElement('div');r.className='row';
    const s=document.createElement('button');s.className='btn';s.textContent='Estudiar';s.onclick=()=>{curId=m.id;save();render();start()};
    const p=document.createElement('button');p.className='btn ghost';p.textContent='+ Archivo';p.onclick=()=>{addTarget=m.id;$('#file2').click()};
    const x=document.createElement('button');x.className='btn ghost';x.textContent='Borrar';x.onclick=()=>{if(confirm('¿Borrar «'+m.name+'»?')){lib=lib.filter(a=>a!==m);if(curId===m.id)curId=null;save();render()}};
    r.append(s,p,x);li.append(d,r);ul.append(li);
  });
  $('#study').hidden=!cur();
  if(cur())hud();
}
function hud(){const m=cur();$('#cur').textContent=m.name;$('#lvl').textContent=m.level+'/5';$('#xp').textContent=m.xp;
  $('#lvname').textContent=LEVELS[m.level-1]+(m.streak>0?'  ·  🔥 racha de '+m.streak:'');$('#xpbar').style.width=Math.min(100,(m.xp%XP_PER_LEVEL))+'%'}

/* ---------- API ---------- */
class RateErr extends Error{constructor(w,daily){super('límite');this.wait=w;this.daily=daily}}
const TM=[{thinkingBudget:0},{thinkingLevel:'minimal'},{thinkingLevel:'low'},null];let tm=0;
async function ask(prompt,retry=true){
  if(!cfg.key)throw new Error('Añade tu clave de Gemini en Ajustes.');
  const model=cfg.model||'gemini-flash-lite-latest';
  const gc={responseMimeType:'application/json',maxOutputTokens:2000,temperature:1,seed:Math.floor(Math.random()*1e9)};
  if(TM[tm])gc.thinkingConfig=TM[tm];
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':cfg.key},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:gc})});
  if(r.status===400&&tm<TM.length-1){tm++;return ask(prompt,retry)}
  if(r.status===429){
    let d={};try{d=await r.json()}catch(e){}
    const txt=JSON.stringify(d);let w=0;
    const ri=((d.error||{}).details||[]).find(x=>String(x['@type']).includes('RetryInfo'));
    if(ri&&ri.retryDelay)w=parseFloat(ri.retryDelay);else{const mm=/retry in ([\d.]+)s/i.exec(txt);if(mm)w=parseFloat(mm[1])}
    throw new RateErr(Math.ceil(w)||60,/PerDay/i.test(txt)&&!/PerMinute/i.test(txt));
  }
  if(!r.ok){let m=r.status;try{m=(await r.json()).error.message}catch(e){}throw new Error('Gemini: '+m)}
  const d=await r.json();
  const t=((d.candidates||[])[0]?.content?.parts||[]).map(p=>p.text||'').join('');
  try{const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(t.slice(a,b+1))}
  catch(e){if(retry)return ask(prompt,false);throw new Error('Respuesta no válida, inténtalo de nuevo.')}
}

/* ---------- pasajes: cada pregunta sale de una parte distinta ---------- */
const segCache=new Map();
function segs(m){
  const k=m.id+':'+m.text.length;if(segCache.has(k))return segCache.get(k);
  const out=[];let buf='';
  const push=p=>{if(buf.length+p.length>1000&&buf.length>200){out.push(buf);buf=''}buf+=(buf?' ':'')+p};
  for(const p of m.text.split(/\n+/)){
    if(p.length>1200)(p.match(/[^.!?]+[.!?]*\s*/g)||[p]).forEach(push);else push(p);
  }
  if(buf.length>60)out.push(buf);
  segCache.set(k,out);return out;
}
function pick(m,n){
  const S=segs(m);m.used=(m.used||[]).filter(i=>i<S.length);
  let free=S.map((_,i)=>i).filter(i=>!m.used.includes(i));
  if(free.length<n){m.used=[];free=S.map((_,i)=>i)}
  const ch=shuffle(free).slice(0,n);m.used.push(...ch);
  return ch.map(i=>S[i]);
}

/* ---------- sesión (tipo test) ---------- */
let queue=[],qLevel=0,qId=null,loading=null;
async function genBatch(m){
  const pas=pick(m,3);
  const ang=shuffle(['una definición','causa y efecto','un ejemplo concreto','una comparación','una consecuencia','un procedimiento o paso']).slice(0,3).join(', ');
  const r=await ask(`Eres un tutor exigente pero amable. Crea 3 preguntas tipo test de nivel ${m.level} de 5 (${LEVELS[m.level-1]}) basadas SOLO en estos pasajes de apuntes. Si hay varios pasajes, usa uno distinto para cada pregunta; si hay pocos, pregunta por aspectos distintos. Enfoques sugeridos: ${ang}. Cada pregunta: 4 opciones, solo una correcta, distractores plausibles y de longitud parecida. No repitas estas preguntas: ${JSON.stringify(m.asked.slice(-20))}.
Responde SOLO con JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explain":"1-2 frases"}]} donde "answer" es el índice (0-3) de la opción correcta. Idioma de los apuntes.
PASAJES:
${pas.map((p,i)=>'['+(i+1)+'] '+p).join('\n\n')}`);
  const out=[];
  for(const x of (r.questions||[])){
    const ai=Number(x.answer);
    if(!x.question||!Array.isArray(x.options)||x.options.length<2||!(ai>=0&&ai<x.options.length))continue;
    const good=x.options[ai],opts=shuffle(x.options.slice());
    out.push({q:x.question,opts,ans:opts.indexOf(good),explain:x.explain||''});
  }
  if(!out.length)throw new Error('Respuesta no válida, inténtalo de nuevo.');
  m.asked.push(...out.map(o=>o.q));save();
  return out;
}
function refill(m){
  if(!loading){const id=m.id,lv=m.level;
    loading=(async()=>{try{const arr=await genBatch(m);if(qId===id&&qLevel===lv)queue.push(...arr)}finally{loading=null}})()}
  return loading;
}
async function getQ(m){
  if(qId!==m.id||qLevel!==m.level){queue=[];qId=m.id;qLevel=m.level}
  for(let i=0;i<3&&!queue.length;i++)await refill(m);
  if(!queue.length)throw new Error('No se pudo generar la pregunta. Inténtalo de nuevo.');
  const q=queue.shift();
  if(queue.length<2)refill(m).catch(()=>{});
  return q;
}
async function start(){$('#study').scrollIntoView();await nextQ()}
async function nextQ(){
  const m=cur();if(!m)return;
  clearInterval(cool);
  const qb=$('#qbox');
  $('#fb').hidden=true;$('#next').hidden=true;$('#opts').innerHTML='';$('#idk').disabled=true;
  qb.className='qbox load';
  const t0=Date.now(),iv=setInterval(()=>{qb.textContent='Preparando pregunta… '+Math.round((Date.now()-t0)/1000)+' s'},1000);
  qb.textContent='Preparando pregunta…';
  try{
    turn=await getQ(m);
    qb.className='qbox';void qb.offsetWidth;qb.className='qbox in';qb.textContent=turn.q;
    turn.opts.forEach((o,j)=>{const b=document.createElement('button');b.className='opt';b.style.setProperty('--i',j);b.textContent=o;b.onclick=()=>choose(j);$('#opts').append(b)});
    $('#idk').disabled=false;
  }catch(e){
    qb.className='qbox';
    if(e instanceof RateErr){
      if(e.daily){qb.textContent='Has agotado el límite diario gratuito. Se reinicia a medianoche (hora del Pacífico, sobre las 9:00 en España). Puedes cambiar de modelo en Ajustes.';$('#next').textContent='Reintentar';$('#next').hidden=false}
      else{let s=e.wait;const tick=()=>{qb.textContent='Límite gratuito alcanzado. Reintentando en '+s+' s…';if(s--<=0){clearInterval(cool);nextQ()}};tick();cool=setInterval(tick,1000)}
    }else{qb.textContent=e.message;$('#next').textContent='Reintentar';$('#next').hidden=false}
  }finally{clearInterval(iv)}
}
function burst(){
  const cols=['var(--hl)','var(--accent)','var(--ok)'];
  for(let i=0;i<34;i++){const s=document.createElement('span');s.className='cf';
    s.style.cssText='--dx:'+(Math.random()*520-260)+'px;--dy:'+(Math.random()*-320-40)+'px;--r:'+(Math.random()*720-360)+'deg;background:'+cols[i%3];
    document.body.append(s);setTimeout(()=>s.remove(),1300)}
}
function choose(j){
  const m=cur();if(!turn||turn.done)return;turn.done=1;
  const ok=j===turn.ans;
  document.querySelectorAll('#opts .opt').forEach((b,k)=>{b.disabled=true;if(k===turn.ans)b.classList.add('ok','pop');else if(k===j)b.classList.add('bad','shake')});
  $('#idk').disabled=true;let note='',gain=0;
  if(ok){gain=10*m.level;m.xp+=gain;m.streak=Math.max(0,m.streak)+1}else m.streak=Math.min(0,m.streak)-1;
  if(m.streak>=3&&m.level<5){m.level++;m.streak=0;note='¡Subes al nivel '+m.level+'! '+LEVELS[m.level-1];burst()}
  else if(m.streak<=-2&&m.level>1){m.level--;m.streak=0;note='Bajas al nivel '+m.level+' para afianzar la base.'}
  save();hud();
  if(gain){const s=document.createElement('span');s.className='xpfly';s.textContent='+'+gain;$('#xp').parentElement.append(s);setTimeout(()=>s.remove(),1000)}
  const f=$('#fb');f.className='fb in '+(ok?'correcta':'incorrecta');f.innerHTML='<b></b><p class="a"></p><p class="lvup"></p>';
  f.querySelector('b').textContent=ok?'Correcta':(j<0?'Sin responder':'Incorrecta');
  f.querySelector('.a').textContent=turn.explain;f.querySelector('.lvup').textContent=note;
  f.hidden=false;$('#next').textContent='Siguiente pregunta';$('#next').hidden=false;$('#next').focus();
}
$('#idk').onclick=()=>choose(-1);
$('#next').onclick=nextQ;

/* ---------- ajustes ---------- */
const dlg=$('#set');
$('#openSet').onclick=()=>{$('#key').value=cfg.key;$('#model').value=cfg.model;dlg.showModal()};
$('#closeSet').onclick=()=>dlg.close();
$('#saveSet').onclick=()=>{cfg={key:$('#key').value.trim(),model:$('#model').value.trim()||'gemini-flash-lite-latest'};tm=0;ls.set('sb:cfg',cfg);dlg.close()};

/* ---------- aparición al hacer scroll ---------- */
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('seen');io.unobserve(e.target)}}),{threshold:.12});
  document.querySelectorAll('.rv').forEach(el=>io.observe(el));
}else document.querySelectorAll('.rv').forEach(el=>el.classList.add('seen'));

render();
if(!cfg.key)say('Primero abre Ajustes y pega tu clave de Gemini.');

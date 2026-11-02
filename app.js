const $=s=>document.querySelector(s);
const LEVELS=['Recordar datos y definiciones','Comprender con tus palabras','Aplicar a un caso concreto','Analizar relaciones y causas','Evaluar y razonar con criterio'];
const XP_PER_LEVEL=100;
const ls={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let lib=ls.get('sb:lib',[]),curId=ls.get('sb:cur',null),cfg=ls.get('sb:cfg',{key:'',model:'gemini-flash-latest'}),turn=null;
if(/claude/i.test(cfg.model||'')||/^sk-ant/.test(cfg.key||'')){cfg={key:'',model:'gemini-flash-latest'};ls.set('sb:cfg',cfg)}
const save=()=>{ls.set('sb:lib',lib);ls.set('sb:cur',curId)};
const say=(t,e)=>{const m=$('#msg');m.textContent=t;m.className='msg'+(e?' err':'')};
const cur=()=>lib.find(m=>m.id===curId);

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
$('#file').addEventListener('change',async e=>{
  for(const f of e.target.files){
    say('Leyendo '+f.name+'…');
    try{const t=(await extract(f)).replace(/[ \t]+/g,' ').trim();
      if(t.length<80)throw new Error('sin texto (¿PDF escaneado?)');
      add(f.name.replace(/\.[^.]+$/,''),t);say('Importado: '+f.name)}
    catch(err){say('No se pudo leer '+f.name+': '+err.message,true)}
  }
  e.target.value='';
});
$('#pasteBtn').onclick=()=>{$('#paste').hidden=!$('#paste').hidden};
$('#psave').onclick=()=>{const t=$('#ptext').value.trim();if(t.length<80){say('Pega al menos un párrafo.',true);return}
  add($('#pname').value.trim()||'Apuntes',t);$('#ptext').value='';$('#pname').value='';$('#paste').hidden=true;say('Guardado.')};
function add(name,text){const m={id:Date.now()+Math.random().toString(36).slice(2,6),name,text,level:1,xp:0,streak:0,asked:[]};lib.push(m);curId=m.id;save();render()}

/* ---------- biblioteca ---------- */
function render(){
  const ul=$('#list');ul.innerHTML='';
  lib.forEach(m=>{
    const li=document.createElement('li');if(m.id===curId)li.className='on';
    const d=document.createElement('div');d.innerHTML='<b></b><small></small>';
    d.querySelector('b').textContent=m.name;d.querySelector('small').textContent='Nivel '+m.level+' · '+m.xp+' pts · '+Math.round(m.text.length/1000)+'k caracteres';
    const r=document.createElement('div');r.className='row';
    const s=document.createElement('button');s.className='btn';s.textContent='Estudiar';s.onclick=()=>{curId=m.id;save();render();start()};
    const x=document.createElement('button');x.className='btn ghost';x.textContent='Borrar';x.onclick=()=>{if(confirm('¿Borrar «'+m.name+'»?')){lib=lib.filter(a=>a!==m);if(curId===m.id)curId=null;save();render()}};
    r.append(s,x);li.append(d,r);ul.append(li);
  });
  $('#study').hidden=!cur();
  if(cur())hud();
}
function hud(){const m=cur();$('#cur').textContent=m.name;$('#lvl').textContent=m.level+'/5';$('#xp').textContent=m.xp;
  $('#lvname').textContent=LEVELS[m.level-1];$('#xpbar').style.width=Math.min(100,(m.xp%XP_PER_LEVEL))+'%'}

/* ---------- API ---------- */
let think0=true;
async function ask(prompt,retry=true){
  if(!cfg.key)throw new Error('Añade tu clave de Gemini en Ajustes.');
  const model=cfg.model||'gemini-flash-latest';
  const gc={responseMimeType:'application/json',maxOutputTokens:1200,temperature:0.8};
  if(think0)gc.thinkingConfig={thinkingBudget:0};
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':cfg.key},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:gc})});
  if(r.status===400&&think0){think0=false;return ask(prompt,retry)}
  if(r.status===429)throw new Error('Has alcanzado el límite gratuito. Espera un minuto (o hasta mañana si es el límite diario).');
  if(!r.ok){let m=r.status;try{m=(await r.json()).error.message}catch(e){}throw new Error('Gemini: '+m)}
  const d=await r.json();
  const t=((d.candidates||[])[0]?.content?.parts||[]).map(p=>p.text||'').join('');
  try{const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(t.slice(a,b+1))}
  catch(e){if(retry)return ask(prompt,false);throw new Error('Respuesta no válida, inténtalo de nuevo.')}
}
function chunk(text){const n=5000;if(text.length<=n)return text;const s=Math.floor(Math.random()*(text.length-n));return text.slice(s,s+n)}

/* ---------- sesión (tipo test) ---------- */
let pre=null;
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const k=Math.floor(Math.random()*(i+1));[a[i],a[k]]=[a[k],a[i]]}return a};
async function genQ(m){
  const r=await ask(`Eres un tutor exigente pero amable. Con el fragmento de apuntes, crea UNA pregunta tipo test de nivel ${m.level} de 5 (${LEVELS[m.level-1]}): 4 opciones, solo una correcta, con distractores plausibles y de longitud parecida. Debe poder responderse solo con los apuntes. No repitas estas preguntas: ${JSON.stringify(m.asked.slice(-12))}.
Responde SOLO con JSON: {"question":"...","options":["...","...","...","..."],"answer":0,"explain":"1-2 frases que expliquen por qué es correcta"} donde "answer" es el índice (0-3) de la opción correcta. Idioma de los apuntes.
APUNTES:
${chunk(m.text)}`);
  const ai=Number(r.answer);
  if(!r.question||!Array.isArray(r.options)||r.options.length<2||!(ai>=0&&ai<r.options.length))throw new Error('Pregunta no válida, inténtalo de nuevo.');
  const good=r.options[ai],opts=shuffle(r.options.slice());
  return {q:r.question,opts,ans:opts.indexOf(good),explain:r.explain||''};
}
async function start(){$('#study').scrollIntoView();await nextQ()}
async function nextQ(){
  const m=cur();if(!m)return;
  $('#fb').hidden=true;$('#next').hidden=true;$('#opts').innerHTML='';$('#idk').disabled=true;
  $('#qbox').textContent='Preparando pregunta…';
  const pf=pre&&pre.id===m.id&&pre.level===m.level?pre.p:null;pre=null;
  try{
    try{turn=await (pf||genQ(m))}catch(e){if(!pf)throw e;turn=await genQ(m)}
    m.asked.push(turn.q);save();
    $('#qbox').textContent=turn.q;
    turn.opts.forEach((o,j)=>{const b=document.createElement('button');b.className='opt';b.textContent=o;b.onclick=()=>choose(j);$('#opts').append(b)});
    $('#idk').disabled=false;
    pre={id:m.id,level:m.level,p:genQ(m)};pre.p.catch(()=>{});
  }catch(e){$('#qbox').textContent=e.message;$('#next').textContent='Reintentar';$('#next').hidden=false}
}
function choose(j){
  const m=cur();if(!turn||turn.done)return;turn.done=1;
  const ok=j===turn.ans;
  document.querySelectorAll('#opts .opt').forEach((b,k)=>{b.disabled=true;if(k===turn.ans)b.classList.add('ok');else if(k===j)b.classList.add('bad')});
  $('#idk').disabled=true;let note='';
  if(ok){m.xp+=10*m.level;m.streak=Math.max(0,m.streak)+1}else m.streak=Math.min(0,m.streak)-1;
  if(m.streak>=3&&m.level<5){m.level++;m.streak=0;note='¡Subes al nivel '+m.level+'! '+LEVELS[m.level-1]}
  else if(m.streak<=-2&&m.level>1){m.level--;m.streak=0;note='Bajas al nivel '+m.level+' para afianzar la base.'}
  save();hud();
  const f=$('#fb');f.className='fb '+(ok?'correcta':'incorrecta');f.innerHTML='<b></b><p class="a"></p><p class="lvup"></p>';
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
$('#saveSet').onclick=()=>{cfg={key:$('#key').value.trim(),model:$('#model').value.trim()||'gemini-flash-latest'};ls.set('sb:cfg',cfg);dlg.close()};
render();
if(!cfg.key)say('Primero abre Ajustes y pega tu clave de Gemini.');

const $=s=>document.querySelector(s);
const DEF='gemini-flash-lite-latest',XP_PER_LEVEL=100,SES=10;
const LEVELS=['Recordar datos y definiciones','Comprender con tus palabras','Aplicar a un caso concreto','Analizar relaciones y causas','Evaluar y razonar con criterio'];
const ls={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
let lib=[],curId=ls.get('sb:cur',null),turn=null,addTarget=null,cool=null,ses=null,rid=0;
let cfg={key:'',model:DEF,goal:20,fx:false,...ls.get('sb:cfg',{})};
let stats=ls.get('sb:stats',{days:{}});
if(/claude/i.test(cfg.model||'')||/^sk-ant/.test(cfg.key||'')){cfg={...cfg,key:'',model:DEF};ls.set('sb:cfg',cfg)}
const say=(t,e)=>{const m=$('#msg');m.textContent=t;m.className='msg'+(e?' err':'')};
const cur=()=>lib.find(m=>m.id===curId);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const k=Math.floor(Math.random()*(i+1));[a[i],a[k]]=[a[k],a[i]]}return a};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- almacenamiento (IndexedDB: mucho más espacio) ---------- */
const idb=new Promise(res=>{try{const q=indexedDB.open('subraya',1);q.onupgradeneeded=()=>q.result.createObjectStore('kv');q.onsuccess=()=>res(q.result);q.onerror=()=>res(null)}catch(e){res(null)}});
const tx=async(mode,f)=>{const d=await idb;if(!d)return null;return new Promise(r=>{const t=d.transaction('kv',mode),q=f(t.objectStore('kv'));t.oncomplete=()=>r(q&&q.result);t.onerror=()=>r(null)})};
const kvGet=k=>tx('readonly',s=>s.get(k)),kvSet=(k,v)=>tx('readwrite',s=>s.put(v,k)),kvDel=k=>tx('readwrite',s=>s.delete(k));
const meta=m=>{const {text,...r}=m;return r};
const saveText=m=>kvSet('t:'+m.id,m.text);
const dirty=new Set();let tmr;
function save(m){if(m)dirty.add(m);clearTimeout(tmr);tmr=setTimeout(flush,250);ls.set('sb:cur',curId)}
async function flush(){const ms=[...dirty];dirty.clear();await kvSet('ids',lib.map(m=>m.id));for(const m of ms)if(lib.includes(m))await kvSet('m:'+m.id,meta(m))}
const fix=m=>{m.used=m.used||[];m.wrong=m.wrong||[];m.count=m.count||0;m.asked=m.asked||[];return m};
async function load(){
  const ids=await kvGet('ids');
  if(!ids){
    const old=ls.get('sb:lib',null);
    if(old&&old.length){lib=old.map(fix);for(const m of lib){await saveText(m);dirty.add(m)}await flush();try{localStorage.removeItem('sb:lib')}catch(e){}}
  }else for(const id of ids){const m=await kvGet('m:'+id),t=await kvGet('t:'+id);if(m&&t!=null)lib.push(fix({...m,text:t}))}
  if(curId&&!cur())curId=null;
  render();
}

/* ---------- API de Gemini ---------- */
class RateErr extends Error{constructor(w,daily){super('límite');this.wait=w;this.daily=daily}}
const TM=[{thinkingBudget:0},{thinkingLevel:'minimal'},{thinkingLevel:'low'},null];
let {tm=0,fb=0}=ls.get('sb:gm',{});const sv=()=>ls.set('sb:gm',{tm,fb});
async function gem(parts,gc){
  if(!cfg.key)throw new Error('Añade tu clave de Gemini en Ajustes.');
  const g={...gc};if(TM[tm])g.thinkingConfig=TM[tm];if(fb>=1)delete g.seed;if(fb>=2){delete g.temperature;delete g.maxOutputTokens}
  let r;
  try{r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(cfg.model||DEF)+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':cfg.key},body:JSON.stringify({contents:[{parts}],generationConfig:g})})}
  catch(e){throw new Error('Sin conexión con Google. Revisa tu internet.')}
  let d={};try{d=await r.json()}catch(e){}
  const msg=(d.error||{}).message||'';
  if(!r.ok){
    if(r.status===400&&!/API key/i.test(msg)){
      if(tm<TM.length-1){tm++;sv();return gem(parts,gc)}
      if(fb<2){fb++;sv();return gem(parts,gc)}
    }
    if(r.status===429){
      const ri=((d.error||{}).details||[]).find(x=>String(x['@type']).includes('RetryInfo'));let w=0;
      if(ri&&ri.retryDelay)w=parseFloat(ri.retryDelay);else{const mm=/retry in ([\d.]+)s/i.exec(JSON.stringify(d));if(mm)w=parseFloat(mm[1])}
      throw new RateErr(Math.ceil(w)||60,/PerDay/i.test(JSON.stringify(d))&&!/PerMinute/i.test(JSON.stringify(d)));
    }
    if(r.status===401||/API key/i.test(msg))throw new Error('Tu clave no es válida. Revísala en Ajustes.');
    if(r.status===404)throw new Error('El modelo «'+(cfg.model||DEF)+'» no existe. Cámbialo en Ajustes.');
    if(r.status===403)throw new Error('Tu clave no tiene permiso para usar este modelo.');
    throw new Error('Gemini: '+(msg||r.status));
  }
  return ((d.candidates||[])[0]?.content?.parts||[]).map(p=>p.text||'').join('');
}
function parseLoose(t){
  const a=t.indexOf('{');if(a<0)throw 0;const s=t.slice(a);
  try{return JSON.parse(s.slice(0,s.lastIndexOf('}')+1))}catch(e){}
  for(let k=s.lastIndexOf('}');k>0;k=s.lastIndexOf('}',k-1)){try{return JSON.parse(s.slice(0,k+1)+']}')}catch(e){}}
  throw 0;
}
async function ask(prompt,n=2){
  for(let i=0;;i++){
    const t=await gem([{text:prompt}],{responseMimeType:'application/json',maxOutputTokens:4096,temperature:1,seed:Math.floor(Math.random()*1e9)});
    try{const o=parseLoose(t);if(o&&o.questions&&o.questions.length)return o;throw 0}
    catch(e){if(i>=n)throw new Error('La IA devolvió una respuesta rara. Pulsa Reintentar.');await sleep(500)}
  }
}

/* ---------- importar archivos ---------- */
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
async function ocr(buf){
  if(buf.byteLength>15e6)throw new Error('PDF escaneado demasiado grande (máx. 15 MB)');
  let b='';const u=new Uint8Array(buf);for(let i=0;i<u.length;i+=32768)b+=String.fromCharCode.apply(null,u.subarray(i,i+32768));
  return gem([{inlineData:{mimeType:'application/pdf',data:btoa(b)}},{text:'Transcribe todo el texto de este documento, sin añadir comentarios.'}],{maxOutputTokens:8192});
}
async function extract(f){
  const ext=f.name.split('.').pop().toLowerCase(),buf=await f.arrayBuffer();
  if(ext==='pdf'){
    const pdf=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;let t='';
    for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i);t+=(await p.getTextContent()).items.map(x=>x.str).join(' ')+'\n'}
    if(t.trim().length<80){say('PDF escaneado: leyéndolo con la IA…');t=await ocr(buf)}
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
    try{const t=(await extract(f)).replace(/[ \t]+/g,' ').trim();if(t.length<80)throw new Error('no se encontró texto');parts.push({name:f.name.replace(/\.[^.]+$/,''),t})}
    catch(err){say('No se pudo leer '+f.name+': '+(err.message||err),true)}
  }
  if(!parts.length)return;
  const block=parts.map(p=>'\n\n=== '+p.name+' ===\n'+p.t).join('');
  if(target){const m=lib.find(x=>x.id===target);if(m){m.text+=block;m.n=(m.n||1)+parts.length;m.used=[];await saveText(m);save(m);render()}}
  else if(parts.length>1&&$('#merge').checked)await add(parts[0].name+' +'+(parts.length-1),block.trim(),parts.length);
  else for(const p of parts)await add(p.name,p.t,1);
  say('Importado correctamente.');
}
$('#file').addEventListener('change',async e=>{await addFiles([...e.target.files],null);e.target.value=''});
$('#file2').addEventListener('change',async e=>{await addFiles([...e.target.files],addTarget);e.target.value=''});
$('#pasteBtn').onclick=()=>{$('#paste').hidden=!$('#paste').hidden};
$('#psave').onclick=async()=>{const t=$('#ptext').value.trim();if(t.length<80){say('Pega al menos un párrafo.',true);return}
  await add($('#pname').value.trim()||'Apuntes',t,1);$('#ptext').value='';$('#pname').value='';$('#paste').hidden=true;say('Guardado.')};
async function add(name,text,n){const m=fix({id:Date.now()+Math.random().toString(36).slice(2,6),name,text,n,level:1,xp:0,streak:0});lib.push(m);curId=m.id;await saveText(m);save(m);render()}

/* ---------- biblioteca ---------- */
function render(){
  const ul=$('#list');ul.innerHTML='';
  lib.forEach(m=>{
    const li=document.createElement('li');if(m.id===curId)li.className='on';
    const d=document.createElement('div');d.innerHTML='<b></b><small></small>';
    d.querySelector('b').textContent=m.name;
    d.querySelector('small').textContent='Nivel '+m.level+' · '+m.xp+' pts · '+(m.n||1)+' archivo'+((m.n||1)>1?'s':'')+' · '+Math.round(m.text.length/1000)+'k caracteres'+(m.wrong.length?' · '+m.wrong.length+' por repasar':'');
    const r=document.createElement('div');r.className='row';
    const mk=(t,c,f)=>{const b=document.createElement('button');b.className=c;b.textContent=t;b.onclick=f;return b};
    r.append(mk('Estudiar','btn',()=>{curId=m.id;save();render();start()}),
      mk('+ Archivo','btn ghost',()=>{addTarget=m.id;$('#file2').click()}),
      mk('Borrar','btn ghost',async()=>{if(confirm('¿Borrar «'+m.name+'»?')){lib=lib.filter(a=>a!==m);if(curId===m.id)curId=null;kvDel('m:'+m.id);kvDel('t:'+m.id);await flush();render()}}));
    li.append(d,r);ul.append(li);
  });
  $('#study').hidden=!cur();
  if(cur())hud();
}
const fmt=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function dayStreak(){let n=0;const d=new Date();if(!stats.days[fmt(d)])d.setDate(d.getDate()-1);while(stats.days[fmt(d)]){n++;d.setDate(d.getDate()-1)}return n}
function daily(){const t=stats.days[fmt(new Date())]||0,g=cfg.goal||20,s=dayStreak();
  $('#dtxt').textContent=(s?'🔥 '+s+' día'+(s>1?'s':'')+' seguido'+(s>1?'s':'')+' · ':'')+'Hoy '+t+'/'+g+(t>=g?' ✓':'');
  $('#dbar').style.width=Math.min(100,100*t/g)+'%'}
function hud(){const m=cur();$('#cur').textContent=m.name;$('#lvl').textContent=m.level+'/5';$('#xp').textContent=m.xp;
  $('#lvname').textContent=LEVELS[m.level-1]+(m.streak>0?'  ·  🔥 racha de '+m.streak:'');$('#xpbar').style.width=(m.xp%XP_PER_LEVEL)+'%';daily()}

/* ---------- pasajes: cada pregunta sale de una parte distinta ---------- */
const segCache=new Map();
function segs(m){
  const k=m.id+':'+m.text.length;if(segCache.has(k))return segCache.get(k);
  const out=[];let buf='';
  const push=p=>{if(buf.length+p.length>1000&&buf.length>200){out.push(buf);buf=''}buf+=(buf?' ':'')+p};
  for(const p of m.text.split(/\n+/)){if(p.length>1200)(p.match(/[^.!?]+[.!?]*\s*/g)||[p]).forEach(push);else push(p)}
  if(buf.length>60)out.push(buf);
  segCache.set(k,out);return out;
}
function pick(m,n){
  const S=segs(m);m.used=m.used.filter(i=>i<S.length);
  let free=S.map((_,i)=>i).filter(i=>!m.used.includes(i));
  if(free.length<n){m.used=[];free=S.map((_,i)=>i)}
  const ch=shuffle(free).slice(0,n);m.used.push(...ch);
  return ch.map(i=>S[i]);
}

/* ---------- preguntas: cola grande, sin invalidarse al cambiar de nivel ---------- */
let queue=[],qId=null,loading=null;
async function genBatch(m){
  const pas=pick(m,5);
  const r=await ask(`Eres un tutor exigente pero amable. Crea 5 preguntas de nivel ${m.level} de 5 (${LEVELS[m.level-1]}) basadas SOLO en estos pasajes de apuntes; usa un pasaje distinto para cada pregunta si hay varios. Mezcla: 3 de elegir entre 4 opciones, 1 de verdadero/falso (una afirmación; options exactamente ["Verdadero","Falso"]) y 1 de rellenar un hueco (frase con _____ y 4 opciones). Solo una opción correcta, distractores plausibles y de longitud parecida. No repitas estas preguntas: ${JSON.stringify(m.asked.slice(-20))}.
Responde SOLO con JSON: {"questions":[{"question":"...","options":["..."],"answer":0,"explain":"1-2 frases"}]} donde "answer" es el índice de la opción correcta. Idioma de los apuntes.
PASAJES:
${pas.map((p,i)=>'['+(i+1)+'] '+p).join('\n\n')}`);
  const out=[];
  for(const x of r.questions){
    const ai=Number(x.answer);
    if(!x.question||!Array.isArray(x.options)||x.options.length<2||!(ai>=0&&ai<x.options.length))continue;
    const good=x.options[ai],opts=x.options.length>2?shuffle(x.options.slice()):x.options.slice();
    out.push({q:x.question,opts,ans:opts.indexOf(good),explain:x.explain||''});
  }
  if(!out.length)throw new Error('La IA devolvió una respuesta rara. Pulsa Reintentar.');
  m.asked.push(...out.map(o=>o.q));save(m);
  return out;
}
function refill(m){
  if(!loading){const id=m.id;loading=(async()=>{try{const arr=await genBatch(m);if(qId===id)queue.push(...arr)}finally{loading=null}})()}
  return loading;
}
async function getQ(m){
  if(qId!==m.id){queue=[];qId=m.id}
  const i=m.wrong.findIndex(w=>w.due<=m.count);
  if(i>=0){const w=m.wrong.splice(i,1)[0];save(m);return {q:w.q,opts:w.opts,ans:w.ans,explain:w.explain,review:true}}
  for(let k=0;k<3&&!queue.length;k++)await refill(m);
  if(!queue.length)throw new Error('No se pudo generar la pregunta. Pulsa Reintentar.');
  const q=queue.shift();
  if(queue.length<3)refill(m).catch(()=>{});
  return q;
}
function start(){ses={n:0,ok:0,t0:Date.now(),xp0:cur().xp,miss:[],end:false};$('#play').hidden=false;$('#sum').hidden=true;$('#study').scrollIntoView();nextQ()}
async function nextQ(){
  const m=cur();if(!m)return;
  if(!ses)ses={n:0,ok:0,t0:Date.now(),xp0:m.xp,miss:[],end:false};
  const my=++rid;clearInterval(cool);
  const qb=$('#qbox');
  $('#fb').hidden=true;$('#next').hidden=true;$('#opts').innerHTML='';$('#idk').disabled=true;$('#tag').hidden=true;
  qb.className='qbox load';qb.textContent='Preparando pregunta…';
  const t0=Date.now(),iv=setInterval(()=>{qb.textContent='Preparando pregunta… '+Math.round((Date.now()-t0)/1000)+' s'},1000);
  try{
    const t=await getQ(m);if(my!==rid)return;
    turn=t;qb.className='qbox';void qb.offsetWidth;qb.className='qbox in';qb.textContent=t.q;$('#tag').hidden=!t.review;
    t.opts.forEach((o,j)=>{const b=document.createElement('button');b.className='opt';b.style.setProperty('--i',j);b.textContent=o;b.onclick=()=>choose(j);$('#opts').append(b)});
    $('#idk').disabled=false;
  }catch(e){
    if(my!==rid)return;
    qb.className='qbox';
    if(e instanceof RateErr){
      if(e.daily){qb.textContent='Has agotado el límite diario gratuito. Se reinicia a medianoche (hora del Pacífico, sobre las 9:00 en España). Puedes probar otro modelo en Ajustes.';$('#next').textContent='Reintentar';$('#next').hidden=false}
      else{let s=e.wait;const tick=()=>{qb.textContent='Límite gratuito alcanzado. Reintentando en '+s+' s…';if(s--<=0){clearInterval(cool);nextQ()}};tick();cool=setInterval(tick,1000)}
    }else{qb.textContent=e.message;$('#next').textContent='Reintentar';$('#next').hidden=false}
  }finally{clearInterval(iv)}
}

/* ---------- efectos ---------- */
let ac;
function tone(seq){if(!cfg.fx)return;try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();let t=ac.currentTime;
  seq.forEach(([f,d])=>{const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f;g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d);t+=d*.8});
  }catch(e){}}
function burst(){
  const cols=['var(--hl)','var(--accent)','var(--ok)'];
  for(let i=0;i<34;i++){const s=document.createElement('span');s.className='cf';
    s.style.cssText='--dx:'+(Math.random()*520-260)+'px;--dy:'+(Math.random()*-320-40)+'px;--r:'+(Math.random()*720-360)+'deg;background:'+cols[i%3];
    document.body.append(s);setTimeout(()=>s.remove(),1300)}
}

/* ---------- responder ---------- */
function choose(j){
  const m=cur();if(!turn||turn.done)return;turn.done=1;
  const ok=j===turn.ans;
  document.querySelectorAll('#opts .opt').forEach((b,k)=>{b.disabled=true;if(k===turn.ans)b.classList.add('ok');else if(k===j)b.classList.add('bad')});
  $('#idk').disabled=true;let note='',gain=0;m.count++;
  if(ok){gain=10*m.level;m.xp+=gain;m.streak=Math.max(0,m.streak)+1;tone([[660,.1],[880,.14]])}
  else{
    m.streak=Math.min(0,m.streak)-1;tone([[200,.25]]);
    m.wrong.push({q:turn.q,opts:turn.opts,ans:turn.ans,explain:turn.explain,due:m.count+4+Math.floor(Math.random()*3)});if(m.wrong.length>30)m.wrong.shift();
    ses.miss.push(turn.q);
  }
  if(m.streak>=3&&m.level<5){m.level++;m.streak=0;note='¡Subes al nivel '+m.level+'! '+LEVELS[m.level-1];burst();tone([[523,.12],[659,.12],[784,.12],[1047,.2]])}
  else if(m.streak<=-2&&m.level>1){m.level--;m.streak=0;note='Bajas al nivel '+m.level+' para afianzar la base.'}
  const k=fmt(new Date());stats.days[k]=(stats.days[k]||0)+1;
  const keys=Object.keys(stats.days).sort();while(keys.length>90)delete stats.days[keys.shift()];
  ls.set('sb:stats',stats);if(stats.days[k]===cfg.goal){burst();note=note||'¡Objetivo diario cumplido!'}
  ses.n++;if(ok)ses.ok++;save(m);hud();
  if(gain){const s=document.createElement('span');s.className='xpfly';s.textContent='+'+gain;$('#xp').parentElement.append(s);setTimeout(()=>s.remove(),1000)}
  const f=$('#fb');f.className='fb in '+(ok?'correcta':'incorrecta');f.innerHTML='<b></b><p class="a"></p><p class="lvup"></p>';
  f.querySelector('b').textContent=ok?'✓ Correcta':(j<0?'Sin responder':'✗ Incorrecta');
  f.querySelector('.a').textContent=turn.explain;f.querySelector('.lvup').textContent=note;
  f.hidden=false;
  ses.end=ses.n>=SES;$('#next').textContent=ses.end?'Ver resumen':'Siguiente pregunta';$('#next').hidden=false;$('#next').focus();
}
function summary(){
  const m=cur(),s=$('#sum');$('#play').hidden=true;s.hidden=false;
  const pct=Math.round(100*ses.ok/ses.n),secs=Math.round((Date.now()-ses.t0)/1000);
  s.innerHTML='<h3>Sesión completada</h3><div class="big"></div><p class="d"></p>';
  s.querySelector('.big').textContent=ses.ok+'/'+ses.n;
  s.querySelector('.d').textContent=pct+'% de aciertos · '+Math.floor(secs/60)+' min '+(secs%60)+' s · nivel '+m.level+' · +'+(m.xp-ses.xp0)+' puntos';
  if(ses.miss.length){const h=document.createElement('p');h.textContent='Para repasar (volverán a salir pronto):';const ul=document.createElement('ul');ses.miss.forEach(q=>{const li=document.createElement('li');li.textContent=q;ul.append(li)});s.append(h,ul)}
  else{const p=document.createElement('p');p.textContent='Sin fallos. Buen trabajo.';s.append(p)}
  const row=document.createElement('div');row.className='ctrl';
  const b1=document.createElement('button');b1.className='btn';b1.textContent='Nueva sesión';b1.onclick=start;
  const b2=document.createElement('button');b2.className='btn ghost';b2.textContent='Volver a mis apuntes';b2.onclick=()=>$('#lib').scrollIntoView();
  row.append(b1,b2);s.append(row);if(pct>=80)burst();s.scrollIntoView();
}
$('#idk').onclick=()=>choose(-1);
$('#next').onclick=()=>{if(ses&&ses.end)summary();else nextQ()};
document.addEventListener('keydown',e=>{
  if(dlg.open||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
  if(/^[1-4]$/.test(e.key)){const b=document.querySelectorAll('#opts .opt')[+e.key-1];if(b&&!b.disabled){b.click();e.preventDefault()}}
  else if(e.key==='Enter'&&!$('#next').hidden&&document.activeElement!==$('#next')){$('#next').click();e.preventDefault()}
});

/* ---------- ajustes ---------- */
const dlg=$('#set');
$('#openSet').onclick=()=>{$('#key').value=cfg.key;$('#model').value=cfg.model;$('#goal').value=cfg.goal;$('#fx').checked=cfg.fx;dlg.showModal()};
$('#closeSet').onclick=()=>dlg.close();
$('#saveSet').onclick=()=>{cfg={key:$('#key').value.trim(),model:$('#model').value.trim()||DEF,goal:Math.max(5,+$('#goal').value||20),fx:$('#fx').checked};tm=0;fb=0;sv();ls.set('sb:cfg',cfg);dlg.close();if(cur())daily()};
$('#exp').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({v:2,lib,stats})],{type:'application/json'}));a.download='subraya-progreso.json';document.body.append(a);a.click();a.remove()};
$('#imp').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{
    const d=JSON.parse(await f.text());if(!Array.isArray(d.lib))throw 0;
    if(!confirm('Esto reemplazará tus temas actuales por los del archivo. ¿Continuar?'))return;
    for(const m of lib){kvDel('m:'+m.id);kvDel('t:'+m.id)}
    lib=d.lib.map(fix);stats=d.stats||{days:{}};ls.set('sb:stats',stats);
    for(const m of lib){await saveText(m);dirty.add(m)}
    curId=null;await flush();render();dlg.close();say('Progreso importado.');
  }catch(err){alert('El archivo no es válido.')}
};

/* ---------- aparición al hacer scroll ---------- */
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('seen');io.unobserve(e.target)}}),{threshold:.12});
  document.querySelectorAll('.rv').forEach(el=>io.observe(el));
}else document.querySelectorAll('.rv').forEach(el=>el.classList.add('seen'));

load();
if(!cfg.key)say('Primero abre Ajustes y pega tu clave de Gemini.');

const $=s=>document.querySelector(s);
const DEF='gemini-flash-lite-latest',XP_PER_LEVEL=100,SES=10;
const LEVELS=[['Novato','Recordar datos y definiciones básicas','#38BDF8'],['Aprendiz','Reconocer y recordar conceptos','#2DD4BF'],['Estudiante','Comprender con tus palabras','#4ADE80'],['Aplicado','Aplicar a casos sencillos','#A3E635'],['Avanzado','Aplicar a casos nuevos','#FACC15'],['Analista','Analizar causas y relaciones','#FB923C'],['Estratega','Comparar, contrastar y deducir','#F87171'],['Experto','Evaluar y argumentar con criterio','#F472B6'],['Maestro','Casos complejos y excepciones','#C084FC'],['Leyenda','Dominio total: matices y trampas','#FBBF24'],['Erudito','Integrar varios conceptos en una misma pregunta','#06B6D4'],['Sabio','Detectar errores sutiles y afirmaciones casi correctas','#10B981'],['Prodigio','Casos límite y excepciones poco evidentes','#84CC16'],['Visionario','Razonamiento en varios pasos con datos del texto','#EAB308'],['Eminencia','Distinguir matices entre conceptos muy parecidos','#F97316'],['Oráculo','Deducir consecuencias no dichas explícitamente','#EF4444'],['Titán','Problemas complejos que combinan varias partes del texto','#EC4899'],['Coloso','Trampas conceptuales y falsos amigos','#A855F7'],['Mítico','Preguntas de examen muy exigentes, sin pistas','#6366F1'],['Trascendente','Dominio absoluto: máxima dificultad, sin ambigüedad','#E11D74']];
const roman=n=>{let s='';for(const [v,r] of [[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']])while(n>=v){s+=r;n-=v}return s};
const PD=['Máxima dificultad sostenida, sin pistas','Casos extremos y razonamiento encadenado','Examen de élite: matices, trampas y excepciones'];
for(let k=1;k<=40;k++)LEVELS.push(['Prestigio '+roman(k),PD[k%3],'hsl('+Math.round((k*137.5)%360)+',75%,55%)']);
const STAGES=LEVELS.length,SUBS=5,MAXL=STAGES*SUBS;
const pg=s=>s<=10?25:Math.max(15,Math.round(25-0.75*(s-10))),pl=s=>Math.round(pg(s)*0.6);
const stage=l=>Math.min(STAGES,Math.ceil(Math.max(1,l)/SUBS)),sub=l=>((Math.max(1,l)-1)%SUBS)+1;
const lvLabel=l=>LEVELS[stage(l)-1][0]+(stage(l)>20?' · ':' ')+sub(l);
const lvDesc=l=>LEVELS[stage(l)-1][1]+' (dificultad '+sub(l)+' de '+SUBS+' dentro de la etapa)';
const lvCol=l=>{const s=sub(l)-1,c=LEVELS[stage(l)-1][2];return s?'color-mix(in srgb,'+c+' '+(100-s*7)+'%,#fff)':c};
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const ls={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
let lib=[],curId=ls.get('sb:cur',null),turn=null,addTarget=null,cool=null,ses=null,rid=0,mode='practice',ex=null,exTok=0,idle=true;
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
const fix=m=>{if(!m.v50){m.level=(Math.min(Math.max(m.level||1,1),STAGES)-1)*SUBS+1;m.v50=1;m.prog=0}
  m.level=Number.isFinite(m.level)?Math.min(Math.max(1,Math.round(m.level)),MAXL):1;m.streak=Number.isFinite(m.streak)?m.streak:0;m.xp=Number.isFinite(m.xp)?m.xp:0;m.elo=Number.isFinite(m.elo)?m.elo:(m.xp||0);m.prog=m.prog||0;m.exams=m.exams||[];m.used=m.used||[];m.wrong=m.wrong||[];m.count=m.count||0;m.asked=m.asked||[];return m};
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
const inflight=new Set();
function abortAll(){inflight.forEach(c=>c.abort());inflight.clear();loading=null}
async function gem(parts,gc){
  if(!cfg.key)throw new Error('Añade tu clave de Gemini en Ajustes.');
  const g={...gc};if(TM[tm])g.thinkingConfig=TM[tm];if(fb>=1)delete g.seed;if(fb>=2){delete g.temperature;delete g.maxOutputTokens}
  const c=new AbortController(),to=setTimeout(()=>{c.timedOut=1;c.abort()},45000);inflight.add(c);
  let r,d={};
  try{
    r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(cfg.model||DEF)+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':cfg.key},body:JSON.stringify({contents:[{parts}],generationConfig:g}),signal:c.signal});
    try{d=await r.json()}catch(e){if(e&&e.name==='AbortError')throw e}
  }catch(e){
    if(e&&e.name==='AbortError')throw new Error(c.timedOut?'Gemini tarda demasiado en responder (más de 45 s). Pulsa Reintentar.':'Cancelado.');
    throw new Error('Sin conexión con Google. Revisa tu internet.');
  }finally{clearTimeout(to);inflight.delete(c)}
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
async function add(name,text,n){const m=fix({id:Date.now()+Math.random().toString(36).slice(2,6),name,text,n,level:1,v50:1,elo:0,streak:0});lib.push(m);curId=m.id;await saveText(m);save(m);resetPractice();render()}

/* ---------- biblioteca ---------- */
function render(){
  try{renderSide()}catch(e){console.error(e);if(window.__err)__err('temario: '+e.message)}
  $('#study').hidden=!cur();
  try{if(cur())hud()}catch(e){console.error(e);if(window.__err)__err('hud: '+e.message)}
  try{renderRanks()}catch(e){console.error(e);if(window.__err)__err('rangos: '+e.message)}
}
/* ---------- temario (barra lateral) ---------- */
function renderSide(){
  const ul=$('#tlist');ul.innerHTML='';
  if(!lib.length){ul.append(el('li','empty','Aún no tienes temarios. Sube tus apuntes para crear el primero.'));return}
  lib.forEach(m=>{
    const r=rankOf(m.elo),li=el('li','ti'+(m.id===curId?' on':'')),b=document.createElement('button');
    b.className='tbtn';b.setAttribute('aria-current',m.id===curId?'true':'false');
    const ic=el('span','tb');ic.innerHTML=badge(r,30);
    const d=el('span','tx');
    d.append(el('b',null,m.name),el('small',null,'Nivel '+m.level+' · '+rankName(r)+' · '+m.elo.toLocaleString('es-ES')+' ELO'+(m.wrong.length?' · '+m.wrong.length+' por repasar':'')));
    const pb=el('span','mini'),pi=document.createElement('i');pi.style.width=(m.level>=MAXL?100:m.prog)+'%';pi.style.background=lvCol(Math.min(m.level,MAXL));pb.append(pi);d.append(pb);
    b.append(ic,d);b.onclick=()=>select(m.id);li.append(b);ul.append(li);
  });
}
function setIdle(v){idle=v;$('#pstart').hidden=!v;if(v){$('#play').hidden=true;$('#sum').hidden=true}else $('#play').hidden=false}
function resetPractice(){exReset();turn=null;ses=null;rid++;clearInterval(cool);setIdle(true);setMode('practice')}
function select(id){
  closeSide();
  if(id!==curId){curId=id;save();resetPractice();render()}
  $('#study').scrollIntoView({behavior:'smooth'});
}
$('#begin').onclick=()=>start();
$('#newt').onclick=()=>{closeSide();$('#lib').scrollIntoView({behavior:'smooth'})};
$('#tadd').onclick=()=>{if(!curId)return;addTarget=curId;$('#file2').click()};
$('#tren').onclick=()=>{const m=cur();if(!m)return;const nm=(prompt('Nuevo nombre del temario:',m.name)||'').trim();if(!nm||nm===m.name)return;m.name=nm.slice(0,80);save(m);render()};
$('#tdel').onclick=async()=>{
  const m=cur();if(!m)return;
  if(!confirm('¿Borrar el temario «'+m.name+'» con todo su progreso? No se puede deshacer.'))return;
  lib=lib.filter(a=>a!==m);curId=null;kvDel('m:'+m.id);kvDel('t:'+m.id);await flush();resetPractice();render();
};
function toggleSide(o){$('#side').classList.toggle('open',o);$('#sbk').hidden=!o}
function closeSide(){toggleSide(false)}
$('#openSide').onclick=()=>toggleSide(true);$('#sbk').onclick=closeSide;
const fmt=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function dayStreak(){let n=0;const d=new Date();if(!stats.days[fmt(d)])d.setDate(d.getDate()-1);while(stats.days[fmt(d)]){n++;d.setDate(d.getDate()-1)}return n}
function daily(){const t=stats.days[fmt(new Date())]||0,g=cfg.goal||20,s=dayStreak();
  $('#dtxt').textContent=(s?'🔥 '+s+' día'+(s>1?'s':'')+' seguido'+(s>1?'s':'')+' · ':'')+'Hoy '+t+'/'+g+(t>=g?' ✓':'');
  $('#dbar').style.width=Math.min(100,100*t/g)+'%'}
/* ---------- ELO y rangos ---------- */
const RANKS=[['Hierro',200,'#8A8D94'],['Bronce',400,'#B0773A'],['Plata',800,'#C9CED8'],['Oro',1600,'#E6B33A'],['Platino',3200,'#35B9B0'],['Diamante',6400,'#8B7CF6'],['Ascendente',12800,'#2FBF71'],['Inmortal',25600,'#E04861'],['Radiante',51200,'#FFD76A']];
const eloGain=s=>Math.round(10*Math.pow(Math.min(s,10),1.25)),eloLoss=s=>Math.round(eloGain(s)/2);
const rankOf=e=>{let i=-1;RANKS.forEach((r,k)=>{if(e>=r[1])i=k});return i};
const rankName=i=>i<0?'Sin rango':RANKS[i][0];
const totalElo=()=>lib.reduce((s,m)=>s+(m.elo||0),0);
function badge(i,sz){
  const c=i<0?'#6B7280':RANKS[i][2],n=i<0?0:(i%3)+1,w='fill="#fff" fill-opacity=".93"';let g='';
  for(let k=0;k<n;k++){const y=41+k*8-(n-1)*4;g+='<path d="M20 '+y+'L32 '+(y-9)+'L44 '+y+'V'+(y+5)+'L32 '+(y-4)+'L20 '+(y+5)+'Z" '+w+'/>'}
  if(i>=6)g+='<path d="M32 9L37 16L32 23L27 16Z" '+w+'/>';else if(i>=3)g+='<circle cx="32" cy="16" r="3.8" '+w+'/>';
  if(i<0)g='<path d="M24 34H40" stroke="#fff" stroke-opacity=".7" stroke-width="4" stroke-linecap="round"/>';
  return '<svg class="badge" width="'+sz+'" height="'+sz+'" viewBox="0 0 64 64" role="img" aria-label="'+rankName(i)+'"><path d="M32 3L57 13V33C57 48 46 57 32 61C18 57 7 48 7 33V13Z" fill="'+c+'" stroke="rgba(0,0,0,.35)" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 3L57 13V33C57 48 46 57 32 61Z" fill="#000" fill-opacity=".14"/>'+g+'</svg>';
}
function showToast(small,big,sub,col,ico){
  const t=$('#lvtoast');t.style.setProperty('--lv',col);
  t.innerHTML=(ico||'')+'<small></small><b></b><span></span>';
  t.querySelector('small').textContent=small;t.querySelector('b').textContent=big;t.querySelector('span').textContent=sub;
  t.hidden=false;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');setTimeout(()=>{t.hidden=true},2300);burst(col);
}
function applyElo(m,d,delay){
  const t0=rankOf(totalElo()),m0=rankOf(m.elo),a=Math.max(-m.elo,d);m.elo+=a;
  const t1=rankOf(totalElo()),m1=rankOf(m.elo);
  const up=(i,tot)=>setTimeout(()=>showToast(tot?'¡Subes de rango total!':'¡Nuevo rango en este tema!',RANKS[i][0],RANKS[i][1]+' ELO',RANKS[i][2],badge(i,64)),delay||250);
  if(t1>t0)up(t1,1);else if(m1>m0)up(m1,0);
  return a;
}
let ladderBuilt=false;
function renderRanks(){
  const tot=totalElo(),i=rankOf(tot),lad=$('#rgladder');
  if(!ladderBuilt){lad.innerHTML='';
    RANKS.forEach((r,k)=>{const d=el('div','tier');d.style.setProperty('--tc',r[2]);d.innerHTML=badge(k,56);d.append(el('b',null,r[0]),el('small',null,r[1].toLocaleString('es-ES')+' ELO'));lad.append(d)});
    ladderBuilt=true}
  [...lad.children].forEach((d,k)=>{d.classList.toggle('reached',k<=i);d.classList.toggle('cur',k===i)});
  $('#ranks').style.setProperty('--tc',i<0?'#6B7280':RANKS[i][2]);
  $('#rgbadge').innerHTML=badge(i,88);$('#rgname').textContent=rankName(i);$('#rgelo').textContent=tot.toLocaleString('es-ES')+' ELO en total';
  const lo=i<0?0:RANKS[i][1],nx=RANKS[i+1];
  $('#rgbar').style.width=(nx?Math.min(100,100*(tot-lo)/(nx[1]-lo)):100)+'%';
  $('#rgnext').textContent=nx?'Te faltan '+(nx[1]-tot).toLocaleString('es-ES')+' ELO para '+nx[0]+'.':'Has alcanzado el rango máximo.';
  const ul=$('#rgtopics');ul.innerHTML='';
  if(!lib.length)ul.append(el('li',null,'Aún no has estudiado ningún tema.'));
  [...lib].sort((a,b)=>b.elo-a.elo).forEach(m=>{
    const li=document.createElement('li'),r=rankOf(m.elo),d=el('div'),h=el('span','tb');h.innerHTML=badge(r,32);
    d.append(el('b',null,m.name),el('small',null,m.elo.toLocaleString('es-ES')+' ELO · '+rankName(r)+' · nivel '+m.level+'/'+MAXL));
    li.append(h,d);ul.append(li);
  });
}
function hud(){const m=cur(),L=LEVELS[stage(m.level)-1];
  $('#study').style.setProperty('--lv',lvCol(m.level));
  $('#cur').textContent=m.name;$('#lvl').textContent=m.level+'/'+MAXL;$('#xp').textContent=m.elo.toLocaleString('es-ES');$('#xrank').textContent=rankName(rankOf(m.elo));
  $('#xpbar').style.width=(m.level>=MAXL?100:m.prog)+'%';$('#bar').classList.toggle('max',m.level>=MAXL);
  $('#lvname').textContent=lvLabel(m.level)+' · '+L[1]+(m.streak>0?'  ·  🔥 racha de '+m.streak:'');daily();renderRanks()}
function bump(){const b=$('#bar');b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump')}
function toast(){const m=cur(),L=LEVELS[stage(m.level)-1],ns=sub(m.level)===1;showToast(ns?'¡Nueva etapa: '+L[0]+'!':'¡Subes de nivel!','Nivel '+m.level,lvLabel(m.level)+' · '+L[1],lvCol(m.level))}
function levelAnim(){$('#xpbar').style.width='100%';const b=$('#bar');b.classList.add('flash');setTimeout(()=>{b.classList.remove('flash');hud();toast()},750)}

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
async function genQs(m,level,n,avoid,need4){
  const pas=pick(m,Math.min(n,6));
  const mix=need4?'Todas con exactamente 4 opciones (puede haber alguna de rellenar un hueco con _____, pero nunca verdadero/falso).':'Mezcla: la mayoría de elegir entre 4 opciones, 1 de verdadero/falso (una afirmación; options exactamente ["Verdadero","Falso"]) y 1 de rellenar un hueco (frase con _____ y 4 opciones).';
  const r=await ask(`Eres un tutor exigente pero amable. Crea ${n} preguntas de nivel ${level} de ${MAXL}: etapa «${LEVELS[stage(level)-1][0]}», ${lvDesc(level)} basadas SOLO en estos pasajes de apuntes; usa un pasaje distinto para cada pregunta si hay varios. ${mix} Solo una opción correcta, distractores plausibles y de longitud parecida. No repitas estas preguntas: ${JSON.stringify(avoid.slice(-20))}.
Responde SOLO con JSON: {"questions":[{"question":"...","options":["..."],"answer":0,"explain":"1-2 frases"}]} donde "answer" es el índice de la opción correcta. Idioma de los apuntes.
PASAJES:
${pas.map((p,i)=>'['+(i+1)+'] '+p).join('\n\n')}`);
  const out=[];
  for(const x of r.questions){
    const ai=Number(x.answer);
    if(!x.question||!Array.isArray(x.options)||x.options.length<2||!(ai>=0&&ai<x.options.length)||(need4&&x.options.length!==4))continue;
    const good=x.options[ai],opts=x.options.length>2?shuffle(x.options.slice()):x.options.slice();
    out.push({q:x.question,opts,ans:opts.indexOf(good),explain:x.explain||'',level});
  }
  if(!out.length)throw new Error('La IA devolvió una respuesta rara. Pulsa Reintentar.');
  return out;
}
async function genBatch(m){const out=await genQs(m,m.level,5,m.asked,false);m.asked.push(...out.map(o=>o.q));save(m);return out}
function refill(m){
  if(!loading){const id=m.id;const p=(async()=>{try{const arr=await genBatch(m);if(qId===id)queue.push(...arr)}finally{if(loading===p)loading=null}})();loading=p}
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
function start(sc=true){ses={n:0,ok:0,t0:Date.now(),e0:cur().elo,miss:[],end:false};setIdle(false);$('#sum').hidden=true;if(sc)$('#study').scrollIntoView();nextQ()}
async function nextQ(){
  const m=cur();if(!m)return;
  if(!ses)ses={n:0,ok:0,t0:Date.now(),e0:m.elo,miss:[],end:false};
  const my=++rid;clearInterval(cool);
  const qb=$('#qbox');
  $('#fb').hidden=true;$('#next').hidden=true;$('#opts').innerHTML='';$('#idk').disabled=true;$('#tag').hidden=true;
  qb.className='qbox load';qb.textContent='Preparando pregunta…';
  const t0=Date.now(),iv=setInterval(()=>{const s=Math.round((Date.now()-t0)/1000);qb.textContent='Preparando pregunta… '+s+' s'+(s>=12?' (Gemini está tardando)':'');if(s>=12&&$('#next').hidden){$('#next').textContent='Cancelar y reintentar';$('#next').hidden=false}},1000);
  try{
    const t=await getQ(m);if(my!==rid)return;
    $('#next').hidden=true;turn=t;qb.className='qbox';void qb.offsetWidth;qb.className='qbox in';qb.textContent=t.q;$('#tag').hidden=!t.review;
    t.opts.forEach((o,j)=>{const b=document.createElement('button');b.className='opt';b.style.setProperty('--i',j);b.textContent=o;b.onclick=()=>choose(j);$('#opts').append(b)});
    $('#idk').disabled=false;
  }catch(e){
    if(my!==rid)return;
    qb.className='qbox';$('#next').hidden=true;
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
function burst(c){
  const cols=c?[c,'var(--hl)','#fff']:['var(--hl)','var(--accent)','var(--ok)'];
  for(let i=0;i<34;i++){const s=document.createElement('span');s.className='cf';
    s.style.cssText='--dx:'+(Math.random()*520-260)+'px;--dy:'+(Math.random()*-320-40)+'px;--r:'+(Math.random()*720-360)+'deg;background:'+cols[i%3];
    document.body.append(s);setTimeout(()=>s.remove(),1300)}
}

/* ---------- responder ---------- */
function choose(j){
  const m=cur();if(!turn||turn.done)return;turn.done=1;
  const ok=j===turn.ans;
  document.querySelectorAll('#opts .opt').forEach((b,k)=>{b.disabled=true;if(k===turn.ans)b.classList.add('ok');else if(k===j)b.classList.add('bad')});
  $('#idk').disabled=true;let note='',up=0;m.count++;const eloD=ok?eloGain(stage(m.level)):-eloLoss(stage(m.level));
  if(ok){m.streak=Math.max(0,m.streak)+1;m.prog+=pg(stage(m.level));tone([[660,.1],[880,.14]])}
  else{
    m.streak=Math.min(0,m.streak)-1;m.prog=Math.max(0,m.prog-pl(stage(m.level)));tone([[200,.25]]);
    m.wrong.push({q:turn.q,opts:turn.opts,ans:turn.ans,explain:turn.explain,due:m.count+4+Math.floor(Math.random()*3)});if(m.wrong.length>30)m.wrong.shift();
    ses.miss.push(turn.q);
  }
  if(m.level<MAXL&&m.prog>=100){m.level++;m.prog=0;m.streak=0;up=1;note='¡Subes al nivel '+m.level+' ('+lvLabel(m.level)+')!';tone([[523,.12],[659,.12],[784,.12],[1047,.2]])}
  else if(m.level>=MAXL&&m.prog>100)m.prog=100;
  else if(m.streak<=-2&&m.level>1){m.level--;m.prog=50;m.streak=0;note='Bajas al nivel '+m.level+' para afianzar la base.'}
  const act=applyElo(m,eloD,up?2700:250);
  const k=fmt(new Date());stats.days[k]=(stats.days[k]||0)+1;
  const keys=Object.keys(stats.days).sort();while(keys.length>90)delete stats.days[keys.shift()];
  ls.set('sb:stats',stats);if(stats.days[k]===cfg.goal){burst();note=note||'¡Objetivo diario cumplido!'}
  ses.n++;if(ok)ses.ok++;save(m);if(window.rankRecord)rankRecord(ok?1:0,1);
  if(up)levelAnim();else{hud();if(act>0)bump()}
  if(act){const s=document.createElement('span');s.className='xpfly'+(act<0?' neg':'');s.textContent=(act>0?'+':'−')+Math.abs(act);$('#xp').parentElement.append(s);setTimeout(()=>s.remove(),1000)}
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
  s.querySelector('.d').textContent=pct+'% de aciertos · '+Math.floor(secs/60)+' min '+(secs%60)+' s · nivel '+m.level+' · '+(m.elo-ses.e0>=0?'+':'−')+Math.abs(m.elo-ses.e0)+' ELO';
  if(ses.miss.length){const h=document.createElement('p');h.textContent='Para repasar (volverán a salir pronto):';const ul=document.createElement('ul');ses.miss.forEach(q=>{const li=document.createElement('li');li.textContent=q;ul.append(li)});s.append(h,ul)}
  else{const p=document.createElement('p');p.textContent='Sin fallos. Buen trabajo.';s.append(p)}
  const row=document.createElement('div');row.className='ctrl';
  const b1=document.createElement('button');b1.className='btn';b1.textContent='Nueva sesión';b1.onclick=start;
  const b2=document.createElement('button');b2.className='btn ghost';b2.textContent='Volver a mis apuntes';b2.onclick=()=>$('#lib').scrollIntoView();
  row.append(b1,b2);s.append(row);if(pct>=80)burst();s.scrollIntoView();
}
$('#idk').onclick=()=>choose(-1);
$('#next').onclick=()=>{if(ses&&ses.end)summary();else{if($('#qbox').classList.contains('load'))abortAll();nextQ()}};

/* ---------- modos: práctica / examen ---------- */
function setMode(x){
  mode=x;document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',b.dataset.m===x));
  $('#practice').hidden=x!=='practice';$('#exam').hidden=x!=='exam';
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  const x=b.dataset.m;setMode(x);
  if(x==='exam'&&!ex)examSetup();
});
document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{$('#exn').value=b.dataset.n});

/* ---------- examen ---------- */
const errText=e=>e instanceof RateErr&&e.daily?'Has agotado el límite diario gratuito. Se reinicia sobre las 9:00 (hora de España).':(e.message||'Error');
function exReset(){if(ex)clearInterval(ex.timer);ex=null;exTok++}
function examSetup(){
  exReset();const m=cur();
  $('#exsetup').hidden=false;$('#exrun').hidden=true;$('#exres').hidden=true;$('#exmsg').textContent='';$('#exmsg').className='msg';$('#exgo').disabled=false;$('#exbuild').hidden=true;
  const h=$('#exhist');h.innerHTML='';
  if(m&&m.exams.length){
    const last=m.exams.slice(-5).reverse(),avg=m.exams.reduce((s,e)=>s+e.grade,0)/m.exams.length;
    h.append(el('p','msg','Tus últimos exámenes · media '+avg.toLocaleString('es-ES',{maximumFractionDigits:1})+'/10'));
    const ul=el('ul','hist');
    last.forEach(e=>ul.append(el('li',null,new Date(e.t).toLocaleDateString('es-ES',{day:'numeric',month:'short'})+' · '+e.n+' preguntas · '+e.grade.toLocaleString('es-ES',{maximumFractionDigits:2})+'/10')));
    h.append(ul);
  }
}
async function withRate(fn,msg){
  for(;;){try{return await fn()}catch(e){
    if(!(e instanceof RateErr)||e.daily)throw e;
    for(let s=e.wait;s>0;s--){msg.textContent='Límite gratuito alcanzado. Reintentando en '+s+' s…';await sleep(1000)}
  }}
}
async function buildExam(m,n,diff,tok){
  const msg=$('#exmsg'),bar=$('#exbar'),cl=m.level,batches=Math.ceil(n/5),qs=[];
  const lo=Math.max(1,cl-SUBS),hi=Math.min(MAXL,cl+SUBS);
  const lvl=k=>diff==='hard'?hi:(diff==='cur'||batches===1)?cl:Math.round(lo+k*(hi-lo)/(batches-1));
  for(let k=0;qs.length<n&&k<batches+4;k++){
    msg.textContent='Preparando examen… '+qs.length+'/'+n;bar.style.width=(100*qs.length/n)+'%';
    const want=Math.min(5,n-qs.length),L=lvl(Math.min(k,batches-1));
    const part=await withRate(()=>genQs(m,L,want,qs.map(q=>q.q),true),msg);
    if(tok!==exTok)return null;
    for(const q of part){if(qs.length<n&&!qs.some(x=>x.q===q.q))qs.push({...q,pick:null})}
  }
  if(qs.length<3)throw new Error('No se pudo generar el examen. Inténtalo de nuevo.');
  bar.style.width='100%';return qs;
}
$('#exgo').onclick=async()=>{
  const m=cur();if(!m)return;
  const n=Math.min(40,Math.max(3,Math.round(+$('#exn').value||10))),diff=$('#exdiff').value,penal=$('#expen').checked;
  const tok=++exTok,msg=$('#exmsg');msg.className='msg';$('#exgo').disabled=true;$('#exbuild').hidden=false;$('#exbar').style.width='0%';
  try{
    const qs=await buildExam(m,n,diff,tok);if(!qs||tok!==exTok)return;
    ex={m,qs,n:qs.length,i:0,penal,t0:Date.now(),done:false};
    $('#exsetup').hidden=true;$('#exrun').hidden=false;$('#exres').hidden=true;exRender();
    ex.timer=setInterval(()=>{const s=Math.floor((Date.now()-ex.t0)/1000);$('#extime').textContent='⏱ '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')},1000);
    $('#extime').textContent='⏱ 0:00';$('#study').scrollIntoView();
  }catch(e){if(tok===exTok){msg.textContent=errText(e);msg.className='msg err'}}
  finally{if(tok===exTok){$('#exgo').disabled=false;$('#exbuild').hidden=true}}
};
function exMark(){
  const q=ex.qs[ex.i],ans=ex.qs.filter(x=>x.pick!=null).length;
  $('#expbar').style.width=(100*ans/ex.n)+'%';
  document.querySelectorAll('#exopts .opt').forEach((b,j)=>b.classList.toggle('sel',q.pick===j));
  const g=$('#exgrid');g.innerHTML='';
  ex.qs.forEach((x,k)=>{const b=el('button',(x.pick!=null?'a ':'')+(k===ex.i?'c':''),String(k+1));b.setAttribute('aria-label','Ir a la pregunta '+(k+1));b.onclick=()=>{ex.i=k;exRender()};g.append(b)});
}
function exRender(){
  const q=ex.qs[ex.i];$('#exinfo').textContent='Pregunta '+(ex.i+1)+' de '+ex.n;
  const qb=$('#exq');qb.className='qbox';void qb.offsetWidth;qb.className='qbox in';qb.textContent=q.q;
  const o=$('#exopts');o.innerHTML='';
  q.opts.forEach((t,j)=>{const b=el('button','opt',t);b.style.setProperty('--i',j);b.onclick=()=>pickAns(j);o.append(b)});
  $('#exprev').disabled=ex.i===0;$('#exnext').disabled=ex.i===ex.n-1;exMark();
}
function pickAns(j){const q=ex.qs[ex.i];if(j>=q.opts.length)return;q.pick=q.pick===j?null:j;exMark();if(document.activeElement&&document.activeElement.blur)document.activeElement.blur()}
const go=k=>{if(ex&&k>=0&&k<ex.n){ex.i=k;exRender()}};
$('#exprev').onclick=()=>go(ex.i-1);$('#exnext').onclick=()=>go(ex.i+1);
$('#exfinish').onclick=()=>{const blank=ex.qs.filter(q=>q.pick==null).length;if(blank&&!confirm('Te quedan '+blank+' sin responder. ¿Entregar igualmente?'))return;examResult()};
function examResult(){
  clearInterval(ex.timer);ex.done=true;const m=ex.m;
  let ok=0,bad=0,blank=0;ex.qs.forEach(q=>{if(q.pick==null)blank++;else if(q.pick===q.ans)ok++;else bad++});
  const raw=ex.penal?Math.max(0,ok-bad/3):ok,grade=Math.round(raw/ex.n*1000)/100;
  const f=n=>n.toLocaleString('es-ES',{maximumFractionDigits:2}),secs=Math.round((Date.now()-ex.t0)/1000);
  m.exams.push({t:Date.now(),n:ex.n,ok,bad,blank,grade,penal:ex.penal});if(m.exams.length>20)m.exams.shift();
  let dE=0;ex.qs.forEach(q=>{if(q.pick==null)return;const L=stage(q.level||m.level);dE+=q.pick===q.ans?eloGain(L):-eloLoss(L)});
  const act=applyElo(m,dE,400);
  ex.qs.forEach(q=>{if(q.pick!==q.ans)m.wrong.push({q:q.q,opts:q.opts,ans:q.ans,explain:q.explain,due:m.count+3+Math.floor(Math.random()*4)})});
  m.wrong=m.wrong.slice(-30);
  if(window.rankRecord)rankRecord(ok,ok+bad);
  const k=fmt(new Date());stats.days[k]=(stats.days[k]||0)+ok+bad;ls.set('sb:stats',stats);
  save(m);render();
  $('#exrun').hidden=true;const r=$('#exres');r.hidden=false;r.innerHTML='';
  const card=el('div','card');
  card.append(el('h3',null,'Examen entregado'));
  const big=el('div','grade','0');const sm=el('small',null,' / 10');big.append(sm);card.append(big);
  const v=grade<5?['Suspenso','var(--bad)']:grade<7?['Aprobado','var(--ok)']:grade<9?['Notable','var(--ok)']:['Sobresaliente','var(--ok)'];
  const vd=el('div','verdict',v[0]);vd.style.color=v[1];card.append(vd);
  card.append(el('p','msg',ok+' aciertos · '+bad+' fallos · '+blank+' en blanco · '+Math.floor(secs/60)+' min '+(secs%60)+' s'));
  card.append(el('p','msg','ELO del examen: '+(act>=0?'+':'−')+Math.abs(act)+' (según la etapa de cada pregunta: de +10 / −5 en Novato a +178 / −89 en Leyenda; más allá no sube)'));
  card.append(el('p','msg',ex.penal?'Nota = ('+ok+' − '+bad+'/3) ÷ '+ex.n+' × 10 (los fallos restan)':'Nota = '+ok+' ÷ '+ex.n+' × 10'));
  if(bad+blank)card.append(el('p','msg','Las preguntas falladas o en blanco se añadirán a tu repaso en la práctica.'));
  const row=el('div','ctrl');
  const b1=el('button','btn','Nuevo examen');b1.onclick=examSetup;
  const b2=el('button','btn ghost','Ir a práctica');b2.onclick=()=>{setMode('practice');if(!turn)start(false)};
  row.append(b1,b2);card.append(row);r.append(card);
  r.append(el('h3',null,'Corrección'));
  ex.qs.forEach((q,i)=>{
    const d=el('details'),good=q.pick===q.ans;
    d.append(el('summary',null,(q.pick==null?'– ':good?'✓ ':'✗ ')+(i+1)+'. '+q.q));
    q.opts.forEach((o,j)=>{const cls=j===q.ans?'ro ok':j===q.pick?'ro bad':'ro';d.append(el('div',cls,(j===q.ans?'✓ ':j===q.pick?'✗ ':'')+o+(j===q.pick?'  (tu respuesta)':'')))});
    if(q.explain)d.append(el('p','msg',q.explain));
    r.append(d);
  });
  const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduce)big.firstChild.textContent=f(grade);
  else{const t0=performance.now(),dur=1000;const step=t=>{const p=Math.min(1,(t-t0)/dur);big.firstChild.textContent=f(Math.round(grade*(1-Math.pow(1-p,3))*100)/100);if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)}
  if(grade>=7)burst();r.scrollIntoView();
}

/* ---------- teclado ---------- */
document.addEventListener('keydown',e=>{
  if($('#view-app').hidden||dlg.open||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
  const btn=document.activeElement.tagName==='BUTTON';
  if(mode==='exam'){
    if(!ex||ex.done||$('#exrun').hidden)return;
    if(/^[1-4]$/.test(e.key)){pickAns(+e.key-1);e.preventDefault()}
    else if(e.key==='ArrowRight'){go(ex.i+1)}else if(e.key==='ArrowLeft'){go(ex.i-1)}
    else if(e.key==='Enter'&&!btn){go(ex.i+1);e.preventDefault()}
    return;
  }
  if(/^[1-4]$/.test(e.key)){const b=document.querySelectorAll('#opts .opt')[+e.key-1];if(b&&!b.disabled){b.click();e.preventDefault()}}
  else if(e.key==='Enter'&&!$('#next').hidden&&document.activeElement!==$('#next')){$('#next').click();e.preventDefault()}
});

/* ---------- ajustes ---------- */
const dlg=$('#set');
$('#openSet').onclick=()=>{$('#key').value=cfg.key;$('#model').value=cfg.model;$('#goal').value=cfg.goal;$('#fx').checked=cfg.fx;dlg.showModal()};
$('#closeSet').onclick=()=>dlg.close();
$('#saveSet').onclick=()=>{cfg={key:$('#key').value.trim(),model:$('#model').value.trim()||DEF,goal:Math.max(5,+$('#goal').value||20),fx:$('#fx').checked};tm=0;fb=0;sv();ls.set('sb:cfg',cfg);dlg.close();if(cur())daily()};
$('#test').onclick=async()=>{
  const o=$('#testout'),old=cfg;o.textContent='Probando…';o.className='msg';
  cfg={...cfg,key:$('#key').value.trim()||cfg.key,model:$('#model').value.trim()||DEF};tm=0;fb=0;sv();
  const t0=Date.now();
  try{await gem([{text:'Responde solo con la palabra: ok'}],{maxOutputTokens:50});o.textContent='✓ Conexión correcta en '+((Date.now()-t0)/1000).toFixed(1)+' s. Pulsa Guardar para conservar estos ajustes.'}
  catch(e){o.textContent='✗ '+errText(e);o.className='msg err'}
  cfg=old;
};
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

/* ---------- pestañas de la cabecera, novedades y exportaciones ---------- */
function seenAll(){const U=window.SB_UPDATES||[];if(U.length)ls.set('sb:seenv',U[0].v);$('#actdot').hidden=true}
function renderUpdates(){
  const box=$('#actlist');box.innerHTML='';const U=window.SB_UPDATES||[],sv=ls.get('sb:seenv',null),si=U.findIndex(x=>x.v===sv);
  U.forEach((u,i)=>{
    const c=el('article','upd'+(i===0?' latest':'')),hd=el('div','uh');
    hd.append(el('span','vtag',u.v));
    const t=el('time',null,u.date?new Date(u.date+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}):(u.when||'Fecha no registrada'));
    if(u.date)t.dateTime=u.date;hd.append(t);
    if(si===-1?i===0:i<si)hd.append(el('span','newtag','Nuevo'));
    c.append(hd,el('h3',null,u.title));
    const ul=el('ul');(u.items||[]).forEach(x=>ul.append(el('li',null,x)));c.append(ul);box.append(c);
  });
  if(!U.length)box.append(el('p','msg','Todavía no hay novedades.'));
}
function route(){
  const h=location.hash.slice(1),v=h==='tutorial'?'tut':h==='novedades'?'act':'app';
  $('#view-app').hidden=v!=='app';$('#view-tut').hidden=v!=='tut';$('#view-act').hidden=v!=='act';
  $('#shell').classList.toggle('noside',v!=='app');
  document.querySelectorAll('.topnav a').forEach(a=>{if(a.dataset.v===v)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  closeSide();
  if(v==='act'){renderUpdates();seenAll()}
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
$('#tutset').onclick=()=>$('#openSet').click();
$('#dlgtut').onclick=()=>{if(dlg.open)dlg.close()};
$('#ver').textContent=window.SB_VERSION||'';
{const U=window.SB_UPDATES||[];$('#actdot').hidden=!U.length||ls.get('sb:seenv',null)===U[0].v}
window.SB={badge,rankOf,rankName,totalElo};
route();

load();
if(!cfg.key)say('Primero abre Ajustes y pega tu clave de Gemini.');

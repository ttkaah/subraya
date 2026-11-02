const $=s=>document.querySelector(s);
const LEVELS=['Recordar datos y definiciones','Comprender con tus palabras','Aplicar a un caso concreto','Analizar relaciones y causas','Evaluar y razonar con criterio'];
const XP_PER_LEVEL=100;
const ls={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let lib=ls.get('sb:lib',[]),curId=ls.get('sb:cur',null),cfg=ls.get('sb:cfg',{key:'',model:'claude-haiku-5-5'}),turn=null;
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
async function ask(prompt){
  if(!cfg.key)throw new Error('Añade tu clave de API en Ajustes.');
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':cfg.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:cfg.model,max_tokens:900,messages:[{role:'user',content:prompt}]})});
  if(!r.ok){let m=r.status;try{m=(await r.json()).error.message}catch(e){}throw new Error('API: '+m)}
  const t=(await r.json()).content.map(c=>c.text||'').join('');
  const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(t.slice(a,b+1));
}
function chunk(text){const n=5000;if(text.length<=n)return text;const s=Math.floor(Math.random()*(text.length-n));return text.slice(s,s+n)}

/* ---------- sesión ---------- */
async function start(){$('#study').scrollIntoView();await nextQ()}
async function nextQ(){
  const m=cur();if(!m)return;
  $('#fb').hidden=true;$('#next').hidden=true;$('#ans').value='';$('#ans').disabled=true;$('#send').disabled=true;$('#idk').disabled=true;
  $('#qbox').textContent='Preparando pregunta…';
  const c=chunk(m.text);
  try{
    const r=await ask(`Eres un tutor exigente pero amable. Con el fragmento de apuntes, formula UNA pregunta abierta de nivel ${m.level} de 5 (${LEVELS[m.level-1]}). Debe poder responderse solo con los apuntes. No repitas estas preguntas ya hechas: ${JSON.stringify(m.asked.slice(-12))}.
Responde SOLO con JSON: {"question":"..."} en el idioma de los apuntes.
APUNTES:
${c}`);
    turn={q:r.question,c};m.asked.push(r.question);save();
    $('#qbox').textContent=r.question;$('#ans').disabled=false;$('#send').disabled=false;$('#idk').disabled=false;$('#ans').focus();
  }catch(e){$('#qbox').textContent=e.message;}
}
async function grade(ans){
  const m=cur();$('#send').disabled=true;$('#idk').disabled=true;$('#ans').disabled=true;
  try{
    const r=await ask(`Corrige la respuesta de un estudiante usando SOLO los apuntes. Pregunta (nivel ${m.level}/5): ${turn.q}
Respuesta del estudiante: ${ans||'(no lo sé)'}
Responde SOLO con JSON: {"verdict":"correcta"|"parcial"|"incorrecta","feedback":"2 frases: qué está bien o mal y cómo mejorar","ideal":"respuesta modelo breve"} en el idioma de los apuntes. Sé justo: "correcta" si lo esencial está bien aunque falten detalles.
APUNTES:
${turn.c}`);
    const v=['correcta','parcial','incorrecta'].includes(r.verdict)?r.verdict:'incorrecta';
    let note='';
    if(v==='correcta'){m.xp+=10*m.level;m.streak=Math.max(0,m.streak)+1}
    else if(v==='parcial'){m.xp+=4*m.level}
    else{m.streak=Math.min(0,m.streak)-1}
    if(m.streak>=2&&m.level<5){m.level++;m.streak=0;note='¡Subes al nivel '+m.level+'! '+LEVELS[m.level-1]}
    else if(m.streak<=-2&&m.level>1){m.level--;m.streak=0;note='Bajas al nivel '+m.level+' para afianzar la base.'}
    save();hud();
    const f=$('#fb');f.className='fb '+v;f.innerHTML='<b></b><p class="a"></p><p class="i"></p><p class="lvup"></p>';
    f.querySelector('b').textContent={correcta:'Correcta',parcial:'Parcial',incorrecta:'Incorrecta'}[v];
    f.querySelector('.a').textContent=r.feedback;f.querySelector('.i').textContent='Respuesta modelo: '+r.ideal;f.querySelector('.lvup').textContent=note;
    f.hidden=false;$('#next').hidden=false;$('#next').focus();
  }catch(e){$('#fb').className='fb incorrecta';$('#fb').textContent=e.message;$('#fb').hidden=false;$('#send').disabled=false;$('#idk').disabled=false;$('#ans').disabled=false}
}
$('#send').onclick=()=>{const a=$('#ans').value.trim();if(a)grade(a)};
$('#idk').onclick=()=>grade('');
$('#next').onclick=nextQ;
$('#ans').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))$('#send').click()});

/* ---------- ajustes ---------- */
const dlg=$('#set');
$('#openSet').onclick=()=>{$('#key').value=cfg.key;$('#model').value=cfg.model;dlg.showModal()};
$('#closeSet').onclick=()=>dlg.close();
$('#saveSet').onclick=()=>{cfg={key:$('#key').value.trim(),model:$('#model').value};ls.set('sb:cfg',cfg);dlg.close()};
render();
if(!cfg.key)say('Primero abre Ajustes y pega tu clave de API.');

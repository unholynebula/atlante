/* =========================================================
   ATLANTE — logica
   Navigazione su hash, cosi' il tasto indietro dell’iPhone
   funziona senza inventarsi una cronologia parallela.
   ========================================================= */
'use strict';

/* Ogni testo che arriva da fuori (PubMed, note dell’utente) passa da qui
   prima di finire in innerHTML: e' l’unico punto in cui serve ricordarselo. */
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
const $ = function(id){ return document.getElementById(id); };

/* ---------------- archivio locale ---------------- */
const K_SALV = 'atlante-salvati', K_NOTE = 'atlante-note';
function load(k, d){ try{ return JSON.parse(localStorage.getItem(k)) || d; }catch(e){ return d; } }
function save(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }
let salvati = load(K_SALV, {});   // {chiave: {tipo,titolo,rif,quando}}
let note = load(K_NOTE, {});      // {chiave: testo}

function toast(m){
  const t = $('toast'); t.textContent = m; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(function(){ t.classList.remove('on'); }, 1900);
}

/* ---------------- utilita' ---------------- */
const LIV_D = {
  A:'Meta-analisi, oppure più studi concordi su soggetti allenati.',
  B:'Studio singolo controllato, o evidenza indiretta solida.',
  C:'Meccanismo plausibile o consenso pratico: non testato direttamente.'
};
function livBadge(l){ return '<span class="liv liv-'+l.toLowerCase()+'">'+l+'</span>'; }
function studiById(ids){
  return (ids||[]).map(function(id){ return STUDI.filter(function(s){ return s.id===id; })[0]; })
                  .filter(Boolean);
}
function studioRiga(s){
  return '<div class="st" data-go="#/studio/'+s.id+'">'+
    '<div class="st-h">'+livBadge(s.liv)+'<span class="st-t">'+esc(s.titolo)+'</span></div>'+
    '<div class="st-m">'+esc(s.autore)+' · '+esc(s.rivista)+' · '+s.anno+'</div>'+
  '</div>';
}

/* ---------------- ricerca locale ---------------- */
function cercaLocale(q){
  const t = q.toLowerCase().trim();
  if(t.length < 2) return [];
  const parole = t.split(/\s+/);
  const hit = function(txt){
    const b = txt.toLowerCase();
    return parole.every(function(p){ return b.indexOf(p) >= 0; });
  };
  const out = [];
  MUSCOLI.forEach(function(m){
    const blob = [m.nome, m.gruppo, m.capi.join(' '), m.funzioni.join(' '), m.stimolo,
                  m.esercizi.map(function(e){return e.n+' '+e.f;}).join(' ')].join(' ');
    if(hit(blob)) out.push({t:'Muscolo', n:m.nome, d:m.funzioni.join(' · '), h:'#/muscolo/'+m.id});
  });
  PROBLEMI.forEach(function(p){
    const blob = [p.t, p.area, p.sintomo, p.cause.map(function(c){return c.c;}).join(' '),
                  p.soluzioni.map(function(s){return s.s+' '+s.come;}).join(' ')].join(' ');
    if(hit(blob)) out.push({t:'Problema', n:p.t, d:p.area, h:'#/problema/'+p.id});
  });
  STUDI.forEach(function(s){
    if(hit([s.titolo, s.sintesi, s.kw, s.autore, s.rivista, s.tema].join(' ')))
      out.push({t:'Studio', n:s.titolo, d:s.autore+' · '+s.anno+' · '+s.tema, h:'#/studio/'+s.id});
  });
  MITI.forEach(function(m, i){
    if(hit(m.m+' '+m.s)) out.push({t:'Mito', n:m.m, d:'verdetto: '+m.v, h:'#/miti'});
  });
  GLOSSARIO.forEach(function(g){
    if(hit(g.t+' '+g.d)) out.push({t:'Glossario', n:g.t, d:g.d.slice(0,90)+'…', h:'#/strumenti'});
  });
  return out;
}

/* ---------------- ricerca live su Europe PMC ---------------- */
/* Europe PMC indicizza PubMed piu' i preprint, risponde in JSON in una sola
   chiamata e dichiara access-control-allow-origin: *, quindi funziona da una
   pagina statica senza server e senza chiave. */
const EPMC = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';
let liveCache = {};
/* Europe PMC cerca per difetto nel testo completo: "lateral raise trapezius"
   restituisce mille articoli in cui una delle tre parole compare da qualche
   parte. Le parole nude vanno qualificate su titolo e abstract e legate in AND
   (6 risultati pertinenti invece di 1016). Le frasi tra virgolette invece
   funzionano solo nel campo predefinito, quindi si lasciano stare, e i termini
   che l'utente qualifica lui (TITLE:, AUTH:, EXT_ID:) passano intatti. */
function costruisciQuery(q){
  const pezzi = q.match(/"[^"]*"|\S+/g) || [];
  const termini = pezzi.map(function(t){
    if(t.charAt(0) === '"') return t;
    if(t.indexOf(':') > 0) return t;
    if(/^(AND|OR|NOT)$/i.test(t)) return t.toUpperCase();
    return 'TITLE_ABS:' + t;
  });
  const uniti = [];
  termini.forEach(function(t, i){
    if(i > 0 && !/^(AND|OR|NOT)$/.test(t) && !/^(AND|OR|NOT)$/.test(termini[i-1])) uniti.push('AND');
    uniti.push(t);
  });
  return uniti.join(' ');
}
/* Il contesto non contiene termini generici come "muscle" o "hypertrophy":
   sono parole che l'utente digita, e includerle renderebbe il filtro inutile.
   Con queste quattro frasi "calf hypertrophy" passa da 480 risultati, quasi
   tutti di siero bovino e ipertrofia vascolare, a 21 pertinenti. */
const CTX_ALLENAMENTO = '(TITLE_ABS:"resistance training" OR TITLE_ABS:"resistance exercise"'
  + ' OR TITLE_ABS:"strength training" OR TITLE_ABS:"weight training")';
function pubmedCerca(q, filtra){
  const base = filtra ? '(' + costruisciQuery(q) + ') AND ' + CTX_ALLENAMENTO
                      : costruisciQuery(q);
  const ord = liveOrdine === 'recenti' ? 'P_PDATE_D%20desc' : 'CITED%20desc';
  const url = EPMC + '?query=' + encodeURIComponent(base) +
              '&format=json&pageSize=25&resultType=core&sort=' + ord;
  if(liveCache[url]) return Promise.resolve(liveCache[url]);
  return fetch(url).then(function(r){
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function(d){
    const res = (d.resultList && d.resultList.result) || [];
    liveCache[url] = res;
    return res;
  });
}
/* Interrogazione diretta, per quando la query e' gia' scritta in linguaggio
   Europe PMC e non va toccata. */
function pubmedCercaGrezza(query){
  const url = EPMC + '?query=' + encodeURIComponent(query) + '&format=json&pageSize=5&resultType=core';
  if(liveCache[url]) return Promise.resolve(liveCache[url]);
  return fetch(url).then(function(r){
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function(d){
    const res = (d.resultList && d.resultList.result) || [];
    liveCache[url] = res;
    return res;
  });
}
function annoDi(r){ return r.pubYear || ''; }
/* Europe PMC marca le sezioni con l'HTML, non con parole in maiuscolo:
   <h4>Purpose</h4> oppure <b>Background:</b>. Cercare le maiuscole nel testo
   ripulito trovava anche "the purpose of this study", e produceva sezioni
   duplicate. Si leggono i marcatori. */
const ET_NOTE = ['background','purpose','objective','objectives','aim','aims','introduction',
  'methods','method','materials and methods','results','discussion','conclusion','conclusions',
  'implications','significance','abstract','summary'];
function ripulisci(h){
  return String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function abstractSezioni(raw){
  if(!raw) return [];
  const re = /<h[34][^>]*>([^<]{2,60})<\/h[34]>|<b[^>]*>\s*([^<]{2,60}?)\s*:?\s*<\/b>/gi;
  const parti = [];
  let m, ultimo = null, idx = 0;
  while((m = re.exec(raw)) !== null){
    const et = (m[1] || m[2] || '').replace(/[:\s]+$/, '').trim();
    if(!et) continue;
    // il grassetto conta come etichetta solo se e' una sezione riconoscibile
    if(m[2] && ET_NOTE.indexOf(et.toLowerCase()) < 0) continue;
    if(ultimo) parti.push({e:ultimo, c:ripulisci(raw.slice(idx, m.index))});
    ultimo = et; idx = re.lastIndex;
  }
  if(ultimo) parti.push({e:ultimo, c:ripulisci(raw.slice(idx))});
  const buone = parti.filter(function(x){ return x.c; });
  return buone.length ? buone : [{e:'Abstract', c:ripulisci(raw)}];
}
const ET_IT = {background:'Contesto',purpose:'Scopo',objective:'Obiettivo',objectives:'Obiettivi',
  aim:'Obiettivo',aims:'Obiettivi',introduction:'Introduzione',methods:'Metodi',method:'Metodo',
  'materials and methods':'Materiali e metodi',results:'Risultati',discussion:'Discussione',
  conclusion:'Conclusioni',conclusions:'Conclusioni',implications:'Implicazioni',
  significance:'Rilevanza',abstract:'Abstract',summary:'Sintesi'};
function etIt(e){ return ET_IT[String(e).toLowerCase()] || e; }

/* ---------------- viste ---------------- */
const V = {};

V.home = function(){
  const nSalv = Object.keys(salvati).length;
  return '<h1>Atlante</h1>'+
  '<p class="lead">Riferimento sull’allenamento basato sulla ricerca. Ogni affermazione porta il suo livello di evidenza; ogni studio citato ha un PMID verificato.</p>'+
  '<h2>Sezioni</h2>'+
  '<div class="idx">'+
    idxRow('Muscoli','#/muscoli', MUSCOLI.length+' schede','Anatomia funzionale, esercizi mappati per funzione e lunghezza, errori tipici.')+
    idxRow('Problemi','#/problemi', PROBLEMI.length+' casi','Dal sintomo alle cause probabili alle soluzioni, in ordine di resa.')+
    idxRow('Studi','#/studi', STUDI.length+' voci','Libreria verificata, più ricerca live su PubMed ed Europe PMC.')+
    idxRow('Miti','#/miti', MITI.length+' voci','Affermazioni da palestra con il verdetto della ricerca.')+
    idxRow('Fonti','#/fonti', FONTI.length+' archivi','Dove cercare, con ricerche già filtrate sui tuoi argomenti.')+
    idxRow('Strumenti','#/strumenti','glossario + calcoli','Termini degli studi e quattro calcolatori.')+
    idxRow('Note','#/note', nSalv+' salvati','Studi messi da parte e appunti tuoi.')+
  '</div>'+
  '<h2>Livelli di evidenza</h2>'+
  '<div class="card"><div class="livkey">'+
    '<div>'+livBadge('A')+'<span>'+LIV_D.A+'</span></div>'+
    '<div>'+livBadge('B')+'<span>'+LIV_D.B+'</span></div>'+
    '<div>'+livBadge('C')+'<span>'+LIV_D.C+'</span></div>'+
  '</div></div>'+
  '<p class="sub" style="margin-top:14px;line-height:1.6;">Circa l’ottanta per cento dei partecipanti in questa letteratura non è allenato, e gli effetti si comprimono nei soggetti esperti. Le direzioni restano affidabili, le grandezze no.</p>';
};
function idxRow(nome, href, meta, desc){
  return '<button class="idx-row" data-go="'+href+'">'+
    '<div class="idx-name">'+nome+'<div class="idx-desc">'+desc+'</div></div>'+
    '<span class="idx-meta">'+meta+'</span><span class="chev">›</span></button>';
}

V.muscoli = function(){
  const gruppi = {};
  MUSCOLI.forEach(function(m){ (gruppi[m.gruppo] = gruppi[m.gruppo] || []).push(m); });
  let h = '<h1>Muscoli</h1><p>Una scheda per gruppo muscolare: cosa determina lo stimolo, quali esercizi coprono quale funzione, e a che lunghezza lo fanno.</p>';
  Object.keys(gruppi).forEach(function(g){
    h += '<h2>'+g+'</h2><div class="idx">';
    gruppi[g].forEach(function(m){
      h += idxRow(m.nome, '#/muscolo/'+m.id, m.esercizi.length+' esercizi', m.funzioni[0]);
    });
    h += '</div>';
  });
  return h;
};

V.muscolo = function(id){
  const m = MUSCOLI.filter(function(x){ return x.id===id; })[0];
  if(!m) return V.muscoli();
  let h = backBtn('#/muscoli','Muscoli') + '<h1>'+m.nome+'</h1>';
  h += '<dl class="kv">'+
    '<dt>Gruppo</dt><dd>'+m.gruppo+'</dd>'+
    '<dt>Capi</dt><dd>'+m.capi.join('<br>')+'</dd>'+
    '<dt>Funzioni</dt><dd>'+m.funzioni.join('<br>')+'</dd>'+
    '<dt>Volume</dt><dd>'+m.volume+'</dd>'+
  '</dl>';
  h += '<h2>Cosa determina lo stimolo</h2><p class="lead">'+m.stimolo+'</p>';
  h += '<h2>Esercizi per funzione</h2>';
  h += '<p class="sub" style="margin-bottom:10px;">Il grado indica quanto l’esercizio serve quel muscolo: A primario, B utile, C marginale. La lunghezza è quella a cui il muscolo lavora nel tratto più caricato.</p>';
  m.esercizi.forEach(function(e){
    h += '<div class="ex">'+
      '<span class="ex-g g-'+e.g+'">'+e.g+'</span>'+
      '<div class="ex-b"><div class="ex-n">'+e.n+'</div>'+
        '<div class="ex-f">'+e.f+'</div>'+
        (e.nota ? '<div class="ex-nota">'+e.nota+'</div>' : '')+
      '</div>'+
      '<span class="len">'+e.l+'</span>'+
    '</div>';
  });
  h += '<h2>Errori che costano</h2><div class="ol">';
  m.errori.forEach(function(e){
    h += '<div class="ol-item"><div class="ol-b">'+
      '<div class="ol-t">'+e.t+livBadge(e.liv)+'</div><div class="ol-s">'+e.s+'</div></div></div>';
  });
  h += '</div>';
  const st = studiById(m.studi);
  if(st.length){ h += '<h2>Studi collegati</h2>' + st.map(studioRiga).join(''); }
  return h;
};

V.problemi = function(){
  let h = '<h1>Problemi</h1><p>Parti dal sintomo. Le cause sono ordinate da più a meno probabile, le soluzioni da quella che risolve più spesso a quella di ripiego.</p><div class="idx">';
  PROBLEMI.forEach(function(p){
    h += idxRow(p.t, '#/problema/'+p.id, p.soluzioni.length+' soluz.', p.area);
  });
  return h + '</div>';
};

V.problema = function(id){
  const p = PROBLEMI.filter(function(x){ return x.id===id; })[0];
  if(!p) return V.problemi();
  let h = backBtn('#/problemi','Problemi') + '<h1>'+p.t+'</h1>';
  h += '<p class="sub" style="margin-bottom:16px;">'+p.area+'</p>';
  h += '<h2>Come si presenta</h2><p class="lead">'+p.sintomo+'</p>';
  h += '<h2>Cause probabili</h2><div class="ol">';
  p.cause.forEach(function(c){
    h += '<div class="ol-item"><div class="ol-b"><div class="ol-s">'+c.c+' '+livBadge(c.liv)+'</div></div></div>';
  });
  h += '</div><h2>Soluzioni</h2><div class="ol">';
  p.soluzioni.forEach(function(s){
    h += '<div class="ol-item"><div class="ol-b">'+
      '<div class="ol-t">'+s.s+livBadge(s.liv)+'</div>'+
      '<div class="ol-s">'+s.come+'</div></div></div>';
  });
  h += '</div>';
  if(p.quando_fermarsi){
    h += '<h2>Quando smettere e farsi vedere</h2><div class="note"><div class="note-t">'+p.quando_fermarsi+'</div></div>';
  }
  const st = studiById(p.studi);
  if(st.length){ h += '<h2>Studi collegati</h2>' + st.map(studioRiga).join(''); }
  return h;
};

let filtroTema = 'tutti';
V.studi = function(){
  const temi = ['tutti'].concat(Object.keys(STUDI.reduce(function(a,s){ a[s.tema]=1; return a; }, {})).sort());
  let h = '<h1>Studi</h1><p>'+STUDI.length+' voci con PMID verificato. Il riassunto è mio: la fonte è sempre a un tocco, per controllarmi.</p>';
  h += '<div class="btnrow" style="margin:0 0 14px;"><button class="btn wide" data-go="#/pubmed">Cerca su PubMed ed Europe PMC ›</button></div>';
  h += '<div class="filters">' + temi.map(function(t){
    return '<button class="fbtn'+(t===filtroTema?' on':'')+'" data-tema="'+t+'">'+t+'</button>';
  }).join('') + '</div>';
  const lista = filtroTema==='tutti' ? STUDI : STUDI.filter(function(s){ return s.tema===filtroTema; });
  h += lista.map(function(s){
    return '<div class="st" data-go="#/studio/'+s.id+'">'+
      '<div class="st-h">'+livBadge(s.liv)+'<span class="tag">'+s.tema+'</span>'+
        (s.oa?'<span class="tag oa">testo libero</span>':'')+'</div>'+
      '<div class="st-t">'+esc(s.titolo)+'</div>'+
      '<div class="st-m">'+esc(s.autore)+' · '+esc(s.rivista)+' · '+s.anno+'</div>'+
      '<div class="st-s">'+s.sintesi+'</div>'+
    '</div>';
  }).join('');
  return h;
};

V.studio = function(id){
  const s = STUDI.filter(function(x){ return x.id===id; })[0];
  if(!s) return V.studi();
  const chiave = 'pmid:'+s.pmid;
  const salvo = !!salvati[chiave];
  let h = backBtn('#/studi','Studi');
  h += '<div class="st-h" style="margin-bottom:8px;">'+livBadge(s.liv)+'<span class="tag">'+s.tema+'</span>'+
       (s.oa?'<span class="tag oa">testo libero</span>':'')+'</div>';
  h += '<h1>'+esc(s.titolo)+'</h1>';
  h += '<dl class="kv" style="margin-top:14px;">'+
    '<dt>Autore</dt><dd>'+esc(s.autore)+'</dd>'+
    '<dt>Rivista</dt><dd>'+esc(s.rivista)+', '+s.anno+'</dd>'+
    '<dt>PMID</dt><dd class="mono">'+esc(s.pmid)+'</dd>'+
    (s.doi?'<dt>DOI</dt><dd class="mono" style="word-break:break-all;">'+esc(s.doi)+'</dd>':'')+
    '<dt>Citazioni</dt><dd>'+s.cit+'</dd>'+
    '<dt>Evidenza</dt><dd>'+LIV_D[s.liv]+'</dd>'+
  '</dl>';
  h += '<h2>Cosa dice</h2><p class="lead">'+s.sintesi+'</p>';
  h += '<div class="btnrow">'+
    '<a class="btn" style="flex:1;text-align:center;line-height:42px;border-bottom-width:1px;" href="https://pubmed.ncbi.nlm.nih.gov/'+esc(s.pmid)+'/" target="_blank" rel="noopener">Apri su PubMed</a>'+
    '<button class="btn'+(salvo?' on':'')+'" data-salva="'+chiave+'" data-tit="'+esc(s.titolo)+'" data-rif="'+esc(s.pmid)+'">'+(salvo?'Salvato':'Salva')+'</button>'+
  '</div>';
  h += '<h2>Abstract originale</h2><div id="abs"><div class="spin">carico…</div></div>';
  h += '<h2>I tuoi appunti</h2>'+
    '<textarea class="ta" id="nota" data-k="'+chiave+'" placeholder="Cosa ti serve ricordare di questo studio…">'+esc(note[chiave]||'')+'</textarea>'+
    '<div class="btnrow"><button class="btn wide" id="salvanota">Salva appunto</button></div>';
  setTimeout(function(){ caricaAbstract(s.pmid); }, 0);
  return h;
};

function caricaAbstract(pmid){
  const box = $('abs'); if(!box) return;
  pubmedCercaGrezza('EXT_ID:'+pmid+' AND SRC:MED').then(function(res){
    if(!box.isConnected) return;
    const r = res[0];
    if(!r || !r.abstractText){ box.innerHTML = '<div class="empty">Abstract non disponibile in formato leggibile.</div>'; return; }
    box.innerHTML = abstractSezioni(r.abstractText).map(function(p){
      return '<dl class="kv"><dt>'+esc(etIt(p.e))+'</dt><dd>'+esc(p.c)+'</dd></dl>';
    }).join('');
  }).catch(function(e){
    if(box.isConnected) box.innerHTML = '<div class="empty">Non riesco a raggiungere Europe PMC.<br>'+esc(e.message)+'</div>';
  });
}

V.miti = function(){
  let h = '<h1>Miti</h1><p>Affermazioni che sentirai in palestra, con il verdetto della ricerca e la fonte da cui viene.</p>';
  MITI.forEach(function(m){
    h += '<div class="card"><div class="ol-t" style="margin-bottom:7px;">'+
      '<span class="verd v-'+m.v+'">'+m.v+'</span>'+livBadge(m.liv)+'</div>'+
      '<h3 style="margin-bottom:7px;">«'+m.m+'»</h3>'+
      '<div class="ol-s">'+m.s+'</div>';
    const st = studiById(m.studi);
    if(st.length) h += '<div style="margin-top:10px;">' + st.map(studioRiga).join('') + '</div>';
    h += '</div>';
  });
  return h;
};

V.fonti = function(){
  let h = '<h1>Fonti</h1><p>Dove cercare quando l’atlante non basta. Le ricerche pronte sono già filtrate sugli argomenti che ti interessano: si aprono nel browser.</p>';
  FONTI.forEach(function(f){
    h += '<div class="card"><h3>'+f.n+'</h3><p style="margin-bottom:10px;">'+f.cosa+'</p>'+
      '<div class="btnrow" style="margin:0 0 '+(f.q.length?'10px':'0')+';">'+
      '<a class="btn wide" style="text-align:center;line-height:42px;border-bottom-width:1px;" href="'+f.url+'" target="_blank" rel="noopener">Apri '+f.n+'</a></div>';
    if(f.q.length){
      h += '<div style="border-top:1px solid var(--line);padding-top:4px;">';
      f.q.forEach(function(q){
        h += '<div class="ex" style="padding:11px 0;"><div class="ex-b"><a class="ex-n" style="border:none;" href="'+q[1]+'" target="_blank" rel="noopener">'+q[0]+'</a></div><span class="chev">↗</span></div>';
      });
      h += '</div>';
    }
    h += '</div>';
  });
  return h;
};

V.strumenti = function(){
  let h = '<h1>Strumenti</h1>';
  h += '<h2>Calcolatori</h2>' + CALC_HTML;
  h += '<h2>Glossario</h2><table class="tbl"><tbody>';
  GLOSSARIO.forEach(function(g){
    h += '<tr><td>'+g.t+'</td><td>'+g.d+'</td></tr>';
  });
  return h + '</tbody></table>';
};

const CALC_HTML =
'<div class="calc"><h3>Massimale stimato</h3>'+
  '<div class="calc-row"><div class="calc-lab">Peso<div class="calc-hint">kg sollevati</div></div><input class="calc-in" id="c1w" type="text" inputmode="decimal" value="100"></div>'+
  '<div class="calc-row"><div class="calc-lab">Ripetizioni</div><input class="calc-in" id="c1r" type="text" inputmode="numeric" value="8"></div>'+
  '<div class="calc-row"><div class="calc-lab">RIR<div class="calc-hint">ripetizioni che ti restavano</div></div><input class="calc-in" id="c1rir" type="text" inputmode="numeric" value="1"></div>'+
  '<div class="calc-out" id="c1out"></div>'+
  '<p class="sub" style="margin:12px 0 0;line-height:1.55;">Epley e Brzycki sono due formule diverse: se divergono molto, sei fuori dall’intervallo in cui sono attendibili (indicativamente sotto le 12 ripetizioni).</p>'+
'</div>'+
'<div class="calc"><h3>Volume settimanale di un muscolo</h3>'+
  '<div class="calc-row"><div class="calc-lab">Serie dirette<div class="calc-hint">il muscolo è il bersaglio</div></div><input class="calc-in" id="c2d" type="text" inputmode="numeric" value="9"></div>'+
  '<div class="calc-row"><div class="calc-lab">Serie indirette<div class="calc-hint">partecipa ma non è il bersaglio</div></div><input class="calc-in" id="c2i" type="text" inputmode="numeric" value="8"></div>'+
  '<div class="calc-out" id="c2out"></div>'+
  '<div class="bar"><i id="c2bar"></i></div>'+
  '<p class="sub" style="margin:10px 0 0;line-height:1.55;">Le indirette contano mezza serie ciascuna, la convenzione del volume frazionale. Riferimento per un allenato: 10-20 serie settimanali, con rendimenti decrescenti oltre.</p>'+
'</div>'+
'<div class="calc"><h3>Carico per un altro numero di ripetizioni</h3>'+
  '<div class="calc-row"><div class="calc-lab">Peso attuale</div><input class="calc-in" id="c3w" type="text" inputmode="decimal" value="100"></div>'+
  '<div class="calc-row"><div class="calc-lab">Ripetizioni attuali</div><input class="calc-in" id="c3r" type="text" inputmode="numeric" value="8"></div>'+
  '<div class="calc-row"><div class="calc-lab">Ripetizioni bersaglio</div><input class="calc-in" id="c3t" type="text" inputmode="numeric" value="12"></div>'+
  '<div class="calc-out" id="c3out"></div>'+
  '<p class="sub" style="margin:12px 0 0;line-height:1.55;">A parità di massimale stimato. Utile per cambiare range senza perdere il filo della progressione.</p>'+
'</div>'+
'<div class="calc"><h3>Percentuale di massimale</h3>'+
  '<div class="calc-row"><div class="calc-lab">Ripetizioni</div><input class="calc-in" id="c4r" type="text" inputmode="numeric" value="8"></div>'+
  '<div class="calc-row"><div class="calc-lab">RIR</div><input class="calc-in" id="c4rir" type="text" inputmode="numeric" value="2"></div>'+
  '<div class="calc-out" id="c4out"></div>'+
  '<p class="sub" style="margin:12px 0 0;line-height:1.55;">Stima a quale percentuale del massimale stai lavorando. Ricorda che le persone sbagliano sistematicamente il RIR, e tendono a sottostimare quanto gli resta.</p>'+
'</div>';

function num(id){ const e=$(id); return e ? (parseFloat(String(e.value).replace(',','.'))||0) : 0; }
function out(v,l){ return '<div class="out-b"><div class="out-v">'+v+'</div><div class="out-l">'+l+'</div></div>'; }
function r1(x){ return Math.round(x*10)/10; }
function calcola(){
  if($('c1out')){
    const w=num('c1w'), r=num('c1r')+num('c1rir');
    const ep = r>0 ? w*(1+r/30) : 0;
    const br = (r>0 && r<37) ? w/(1.0278-0.0278*r) : 0;
    $('c1out').innerHTML = out(r1(ep)+' kg','Epley') + out(r1(br)+' kg','Brzycki') +
      out(r1((ep+br)/2)+' kg','Media');
  }
  if($('c2out')){
    const tot = num('c2d') + num('c2i')*0.5;
    let g='Sotto la soglia utile', cls='low';
    if(tot>=10 && tot<=20){ g='Nella fascia produttiva'; cls=''; }
    else if(tot>20){ g='Oltre: rendimenti bassi, fatica alta'; cls='warn'; }
    $('c2out').innerHTML = out(r1(tot),'Serie frazionali') + out(g,'Giudizio');
    const b=$('c2bar').style; b.width=Math.min(100,tot/24*100)+'%';
    $('c2bar').className = cls;
  }
  if($('c3out')){
    const w=num('c3w'), r=num('c3r'), t=num('c3t');
    const e1 = r>0 ? w*(1+r/30) : 0;
    const nw = t>0 ? e1/(1+t/30) : 0;
    $('c3out').innerHTML = out(r1(nw)+' kg','Peso') +
      out((nw>w?'+':'')+r1(nw-w)+' kg','Differenza') + out(r1(e1)+' kg','Massimale');
  }
  if($('c4out')){
    const r=num('c4r')+num('c4rir');
    const p = r>0 ? 100/(1+r/30) : 0;
    $('c4out').innerHTML = out(Math.round(p)+'%','Del massimale') + out(r1(r),'Rip. equivalenti');
  }
}

V.note = function(){
  const k = Object.keys(salvati);
  let h = '<h1>Note</h1>';
  if(!k.length){
    h += '<div class="empty">Non hai ancora salvato niente.<br>Da qualunque studio, tocca Salva.</div>';
  } else {
    h += '<p>'+k.length+' element'+(k.length===1?'o':'i')+' salvat'+(k.length===1?'o':'i')+'.</p>';
    k.sort(function(a,b){ return (salvati[b].quando||0)-(salvati[a].quando||0); }).forEach(function(c){
      const s = salvati[c], loc = STUDI.filter(function(x){ return 'pmid:'+x.pmid===c; })[0];
      h += '<div class="st">'+
        '<div class="st-t"'+(loc?' data-go="#/studio/'+loc.id+'"':'')+'>'+esc(s.titolo)+'</div>'+
        '<div class="st-m">PMID '+esc(s.rif)+(loc?' · in libreria':' · da PubMed')+'</div>'+
        (note[c] ? '<div class="st-s" style="border-left:1px solid var(--line-2);padding-left:10px;margin-top:8px;">'+esc(note[c])+'</div>' : '')+
        '<div class="btnrow">'+
          '<a class="btn" style="flex:1;text-align:center;line-height:42px;border-bottom-width:1px;" href="https://pubmed.ncbi.nlm.nih.gov/'+esc(s.rif)+'/" target="_blank" rel="noopener">PubMed</a>'+
          '<button class="btn" data-rimuovi="'+esc(c)+'">Rimuovi</button>'+
        '</div></div>';
    });
  }
  return h;
};

/* ---------------- ricerca live ---------------- */
let liveQ = '', liveFiltra = true, liveOrdine = 'citazioni';
V.pubmed = function(){
  let h = backBtn('#/studi','Studi') + '<h1>Ricerca live</h1>'+
    '<p>Interroga Europe PMC, che indicizza PubMed più i preprint. Ordinato per numero di citazioni.</p>'+
    '<div class="searchwrap" style="padding:0;margin-bottom:10px;">'+
      '<input id="lq" type="search" placeholder="es. lengthened partials biceps" value="'+esc(liveQ)+'">'+
      '<button class="btn" id="lgo">Cerca</button></div>'+
    '<div class="btnrow" style="margin:0 0 10px;"><button class="btn wide'+(liveFiltra?' on':'')+'" id="lfil">'+
      (liveFiltra?'Filtro allenamento attivo':'Filtro allenamento spento')+'</button></div>'+
    '<div class="btnrow" style="margin:0 0 14px;">'+
      '<button class="btn'+(liveOrdine==='citazioni'?' on':'')+'" style="flex:1;" data-ord="citazioni">Più citati</button>'+
      '<button class="btn'+(liveOrdine==='recenti'?' on':'')+'" style="flex:1;" data-ord="recenti">Più recenti</button>'+
    '</div>'+
    '<div id="lres"></div>';
  setTimeout(function(){
    const inp = $('lq');
    $('lgo').onclick = function(){ liveQ = inp.value; eseguiLive(); };
    inp.onkeydown = function(e){ if(e.key==='Enter'){ liveQ = inp.value; eseguiLive(); } };
    $('lfil').onclick = function(){ liveFiltra = !liveFiltra; liveCache = {}; vai('#/pubmed', true); };
    if(liveQ) eseguiLive();
  }, 0);
  return h;
};
function eseguiLive(){
  const box = $('lres'); if(!box || !liveQ.trim()) return;
  box.innerHTML = '<div class="spin">interrogo Europe PMC…</div>';
  pubmedCerca(liveQ.trim(), liveFiltra).then(function(res){
    if(!box.isConnected) return;
    if(!res.length){ box.innerHTML = '<div class="empty">Nessun risultato. Prova termini in inglese: la letteratura è in inglese.</div>'; return; }
    box.innerHTML = '<p class="sub" style="margin-bottom:12px;">'+res.length+' risultati</p>' + res.map(function(r){
      const jr = (r.journalInfo && r.journalInfo.journal && r.journalInfo.journal.title) || r.journalTitle || r.bookOrReportDetails || '';
      const tipo = (r.pubType||'').indexOf('review')>=0 ? 'rassegna' : '';
      return '<div class="st" data-live="'+esc(r.id)+'" data-src="'+esc(r.source)+'">'+
        '<div class="st-h">'+
          (r.isOpenAccess==='Y'?'<span class="tag oa">testo libero</span>':'')+
          (r.source==='PPR'?'<span class="tag" style="color:var(--liv-b);border-color:rgba(217,161,60,0.35);">preprint</span>':'')+
          (tipo?'<span class="tag">'+tipo+'</span>':'')+
          '<span class="tag">'+(r.citedByCount||0)+' cit.</span>'+
        '</div>'+
        '<div class="st-t">'+esc(r.title||'')+'</div>'+
        '<div class="st-m">'+esc((r.authorString||'').split(',')[0])+' · '+esc(jr)+' · '+esc(annoDi(r))+'</div>'+
      '</div>';
    }).join('');
  }).catch(function(e){
    if(box.isConnected) box.innerHTML = '<div class="empty">Non riesco a raggiungere Europe PMC.<br>'+esc(e.message)+'</div>';
  });
}
V.live = function(id){
  let h = backBtn('#/pubmed','Ricerca live') + '<div id="lone"><div class="spin">carico…</div></div>';
  setTimeout(function(){
    pubmedCercaGrezza('EXT_ID:'+id+' OR DOI:"'+id+'"').then(function(res){
      const box = $('lone'); if(!box || !box.isConnected) return;
      const r = res[0];
      if(!r){ box.innerHTML = '<div class="empty">Non trovato.</div>'; return; }
      const jr = (r.journalInfo && r.journalInfo.journal && r.journalInfo.journal.title) || r.journalTitle || '';
      const chiave = 'pmid:'+(r.pmid||r.id), salvo = !!salvati[chiave];
      let b = '<div class="st-h" style="margin-bottom:8px;">'+
        (r.isOpenAccess==='Y'?'<span class="tag oa">testo libero</span>':'')+
        '<span class="tag">'+(r.citedByCount||0)+' cit.</span></div>'+
        '<h1>'+esc(r.title||'')+'</h1>'+
        '<dl class="kv" style="margin-top:14px;">'+
          '<dt>Autori</dt><dd>'+esc(r.authorString||'')+'</dd>'+
          '<dt>Rivista</dt><dd>'+esc(jr)+', '+esc(annoDi(r))+'</dd>'+
          (r.pmid?'<dt>PMID</dt><dd class="mono">'+esc(r.pmid)+'</dd>':'')+
          (r.doi?'<dt>DOI</dt><dd class="mono" style="word-break:break-all;">'+esc(r.doi)+'</dd>':'')+
        '</dl>'+
        '<div class="btnrow">'+
          (r.pmid?'<a class="btn" style="flex:1;text-align:center;line-height:42px;border-bottom-width:1px;" href="https://pubmed.ncbi.nlm.nih.gov/'+esc(r.pmid)+'/" target="_blank" rel="noopener">PubMed</a>':'')+
          '<button class="btn'+(salvo?' on':'')+'" data-salva="'+chiave+'" data-tit="'+esc(r.title||'')+'" data-rif="'+esc(r.pmid||'')+'">'+(salvo?'Salvato':'Salva')+'</button>'+
        '</div>'+
        '<h2>Abstract</h2>';
      b += r.abstractText
        ? abstractSezioni(r.abstractText).map(function(p){
            return '<dl class="kv"><dt>'+esc(etIt(p.e))+'</dt><dd>'+esc(p.c)+'</dd></dl>'; }).join('')
        : '<div class="empty">Abstract non disponibile.</div>';
      b += '<h2>I tuoi appunti</h2><textarea class="ta" id="nota" data-k="'+chiave+'">'+esc(note[chiave]||'')+'</textarea>'+
           '<div class="btnrow"><button class="btn wide" id="salvanota">Salva appunto</button></div>';
      box.innerHTML = b;
    });
  }, 0);
  return h;
};

V.cerca = function(q){
  const r = cercaLocale(q);
  let h = '<h1>Risultati</h1><p class="sub" style="margin-bottom:16px;">«'+esc(q)+'» · '+r.length+' nell’atlante</p>';
  if(!r.length){
    h += '<div class="empty">Niente nell’atlante per questi termini.</div>';
  } else {
    const per = {};
    r.forEach(function(x){ (per[x.t] = per[x.t] || []).push(x); });
    Object.keys(per).forEach(function(t){
      h += '<h2>'+t+'</h2><div class="idx">';
      per[t].forEach(function(x){
        h += '<button class="idx-row" data-go="'+x.h+'"><div class="idx-name">'+esc(x.n)+
             '<div class="idx-desc">'+esc(x.d)+'</div></div><span class="chev">›</span></button>';
      });
      h += '</div>';
    });
  }
  h += '<div class="btnrow" style="margin-top:20px;"><button class="btn wide" id="tolive">Cerca «'+esc(q)+'» su PubMed ›</button></div>';
  setTimeout(function(){
    const b = $('tolive');
    if(b) b.onclick = function(){ liveQ = q; vai('#/pubmed'); };
  }, 0);
  return h;
};

function backBtn(href, nome){ return '<button class="back" data-go="'+href+'">‹ '+nome+'</button>'; }

/* ---------------- router ---------------- */
const TITOLI = {muscoli:'Muscoli',problemi:'Problemi',studi:'Studi',miti:'Miti',fonti:'Fonti',
                strumenti:'Strumenti',note:'Note',pubmed:'Ricerca live',cerca:'Ricerca'};
function vai(hash, sostituisci){
  if(sostituisci) location.replace(hash); else location.hash = hash;
  if(sostituisci) route();
}
function route(){
  const parti = (location.hash || '#/').replace(/^#\/?/, '').split('/');
  const v = parti[0] || 'home', arg = decodeURIComponent(parti[1] || '');
  let html, crumb = '';
  if(v==='muscolo'){ html = V.muscolo(arg); crumb = 'Muscoli'; }
  else if(v==='problema'){ html = V.problema(arg); crumb = 'Problemi'; }
  else if(v==='studio'){ html = V.studio(arg); crumb = 'Studi'; }
  else if(v==='live'){ html = V.live(arg); crumb = 'Ricerca live'; }
  else if(v==='cerca'){ html = V.cerca(arg); crumb = 'Ricerca'; }
  else if(V[v]){ html = V[v](); crumb = TITOLI[v] || ''; }
  else { html = V.home(); }
  $('main').innerHTML = html;
  $('crumb').textContent = crumb;
  window.scrollTo(0, 0);
  calcola();
}
window.addEventListener('hashchange', route);

/* ---------------- eventi globali ---------------- */
document.addEventListener('click', function(ev){
  const go = ev.target.closest('[data-go]');
  if(go){ vai(go.getAttribute('data-go')); return; }
  const live = ev.target.closest('[data-live]');
  if(live){ vai('#/live/'+encodeURIComponent(live.getAttribute('data-live'))); return; }
  const ord = ev.target.closest('[data-ord]');
  if(ord){ liveOrdine = ord.getAttribute('data-ord'); liveCache = {}; vai('#/pubmed', true); return; }
  const tema = ev.target.closest('[data-tema]');
  if(tema){ filtroTema = tema.getAttribute('data-tema'); vai('#/studi', true); return; }
  const sv = ev.target.closest('[data-salva]');
  if(sv){
    const k = sv.getAttribute('data-salva');
    if(salvati[k]){ delete salvati[k]; sv.classList.remove('on'); sv.textContent='Salva'; toast('Rimosso dai salvati.'); }
    else {
      salvati[k] = {tipo:'studio', titolo:sv.getAttribute('data-tit'), rif:sv.getAttribute('data-rif'), quando:Date.now()};
      sv.classList.add('on'); sv.textContent='Salvato'; toast('Salvato.');
    }
    if(!save(K_SALV, salvati)) toast('Salvato solo per questa sessione.');
    return;
  }
  const rm = ev.target.closest('[data-rimuovi]');
  if(rm){
    const k = rm.getAttribute('data-rimuovi');
    delete salvati[k]; delete note[k];
    save(K_SALV, salvati); save(K_NOTE, note);
    vai('#/note', true); toast('Rimosso.');
    return;
  }
  if(ev.target.id==='salvanota'){
    const ta = $('nota'); if(!ta) return;
    const k = ta.getAttribute('data-k');
    if(ta.value.trim()) note[k] = ta.value.trim(); else delete note[k];
    toast(save(K_NOTE, note) ? 'Appunto salvato.' : 'Salvato solo per questa sessione.');
  }
});
document.addEventListener('input', function(ev){
  if(ev.target.classList && ev.target.classList.contains('calc-in')) calcola();
});

/* ricerca nell’atlante: aspetta che smetti di scrivere */
let tq = null;
$('q').addEventListener('input', function(e){
  const val = e.target.value;
  clearTimeout(tq);
  tq = setTimeout(function(){
    if(val.trim().length >= 2) vai('#/cerca/'+encodeURIComponent(val.trim()), true);
    else if((location.hash||'').indexOf('#/cerca') === 0) vai('#/', true);
  }, 260);
});
$('brand').addEventListener('click', function(){ $('q').value=''; vai('#/'); });

route();

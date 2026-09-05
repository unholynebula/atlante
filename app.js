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

function avvisa(m){
  const t = $('avviso'); t.textContent = m; t.classList.add('visibile');
  clearTimeout(avvisa._t); avvisa._t = setTimeout(function(){ t.classList.remove('visibile'); }, 1900);
}

/* ---------------- utilita' ---------------- */
/* Le sigle di evidenza sono l'unico posto in cui l'atlante usa il colore:
   ovunque altrove la gerarchia la fanno tipografia e filetti. */
const LIV_D = {
  A:'Meta-analisi, oppure più studi concordi su soggetti allenati.',
  B:'Studio singolo controllato, o evidenza indiretta solida.',
  C:'Meccanismo plausibile o consenso pratico: non testato direttamente.',
  M:'Deriva dalla meccanica o dall’anatomia: non è un’ipotesi da verificare, è una conseguenza.'
};
const PARTI = {
  principi: ['1','I',   'Principi'],
  muscoli:  ['2','II',  'Muscoli'],
  problemi: ['3','III', 'Problemi'],
  studi:    ['4','IV',  'Studi'],
  miti:     ['5','V',   'Miti'],
  fonti:    ['6','VI',  'Fonti'],
  strumenti:['7','VII', 'Strumenti'],
  note:     ['8','VIII','Note']
};
/* Il testo dei contenuti usa **asterischi** per il grassetto: la conversione
   avviene qui, in un punto solo. */
function gr(t){ return String(t==null?'':t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); }
function sigla(l){ return '<span class="sigla sigla-'+l.toLowerCase()+'">'+l+'</span>'; }
function numSez(parte, i){ return '\u00a7'+PARTI[parte][0]+'.'+i; }
function indiceDi(lista, id){ const i = lista.map(function(x){ return x.id; }).indexOf(id); return i<0?null:i+1; }

function studiById(ids){
  return (ids||[]).map(function(id){ return STUDI.filter(function(s){ return s.id===id; })[0]; })
                  .filter(Boolean);
}
function studioRiga(s){
  const n = indiceDi(STUDI, s.id);
  return '<div class="studio" data-vai="#/studio/'+s.id+'">'+
    '<div class="marg">'+sigla(s.liv)+'</div>'+
    '<div><div class="studio-t">'+esc(s.titolo)+'</div>'+
      '<div class="studio-r">'+esc(s.autore)+', '+esc(s.rivista)+', '+s.anno+' \u00b7 '+numSez('studi', n)+'</div>'+
    '</div></div>';
}

function cercaLocale(q){
  const t = q.toLowerCase().trim();
  if(t.length < 2) return [];
  const parole = t.split(/\s+/);
  const hit = function(txt){
    const b = txt.toLowerCase();
    return parole.every(function(p){ return b.indexOf(p) >= 0; });
  };
  const out = [];
  PRINCIPI.forEach(function(x, i){
    if(hit([x.t, x.sommario, x.gruppo, x.corpo.join(' ')].join(' ')))
      out.push({p:'principi', n:numSez('principi',i+1), t:x.t, d:x.sommario, h:'#/principio/'+x.id});
  });
  MUSCOLI.forEach(function(m, i){
    const blob = [m.nome, m.gruppo, m.capi.join(' '), m.funzioni.join(' '), m.stimolo,
                  m.esercizi.map(function(e){return e.n+' '+e.f;}).join(' ')].join(' ');
    if(hit(blob)) out.push({p:'muscoli', n:numSez('muscoli',i+1), t:m.nome,
                            d:m.funzioni.join(' \u00b7 '), h:'#/muscolo/'+m.id});
  });
  PROBLEMI.forEach(function(x, i){
    const blob = [x.t, x.area, x.sintomo, x.cause.map(function(c){return c.c;}).join(' '),
                  x.soluzioni.map(function(s){return s.s+' '+s.come;}).join(' ')].join(' ');
    if(hit(blob)) out.push({p:'problemi', n:numSez('problemi',i+1), t:x.t, d:x.area, h:'#/problema/'+x.id});
  });
  STUDI.forEach(function(s, i){
    if(hit([s.titolo, s.sintesi, s.kw, s.autore, s.rivista, s.tema].join(' ')))
      out.push({p:'studi', n:numSez('studi',i+1), t:s.titolo,
                d:s.autore+', '+s.anno+' \u00b7 '+s.tema, h:'#/studio/'+s.id});
  });
  MITI.forEach(function(m, i){
    if(hit(m.m+' '+m.s)) out.push({p:'miti', n:numSez('miti',i+1), t:m.m, d:'verdetto: '+m.v, h:'#/miti'});
  });
  GLOSSARIO.forEach(function(g){
    if(hit(g.t+' '+g.d)) out.push({p:'strumenti', n:'\u00a76', t:g.t, d:g.d.slice(0,88)+'\u2026', h:'#/strumenti'});
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
  const nude = [], termini = pezzi.map(function(t){
    if(t.charAt(0) === '"') return t;
    if(t.indexOf(':') > 0) return t;
    if(/^(AND|OR|NOT)$/i.test(t)) return t.toUpperCase();
    nude.push(t);
    return 'TITLE_ABS:' + t;
  });
  const uniti = [];
  termini.forEach(function(t, i){
    if(i > 0 && !/^(AND|OR|NOT)$/.test(t) && !/^(AND|OR|NOT)$/.test(termini[i-1])) uniti.push('AND');
    uniti.push(t);
  });
  const perTermini = uniti.join(' ');
  /* Due parole nude possono essere una frase fatta: "lengthened partials"
     come termini separati da' un solo riscontro, come frase sei. Si cercano
     entrambe le forme e si uniscono, cosi' non se ne perde nessuna. */
  if(nude.length > 1 && nude.length === pezzi.length){
    return '("' + nude.join(' ').replace(/"/g, '') + '") OR (' + perTermini + ')';
  }
  return perTermini;
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

function testa(parte, titolo, sommario, num){
  return (parte ? '<div class="occhiello">Parte '+PARTI[parte][1]+' · '+PARTI[parte][2]+'</div>' : '')+
    '<h1>'+(num?'<span class="num">'+num+'</span>':'')+titolo+'</h1>'+
    (sommario ? '<p class="sommario">'+sommario+'</p>' : '');
}
function indietro(href, dove){ return '<button class="indietro" data-vai="'+href+'">← '+dove+'</button>'; }
/* Ogni pagina si chiude con il rimando all'indice e alla parte che la
   contiene: dopo una lunga scorsa il ritorno deve essere sotto il pollice,
   non solo in cima. */
function chiusura(parte){
  return '<div class="chiusura"><button data-vai="#/">↑ Indice generale</button>'+
    (parte ? '<button data-vai="#/'+parte+'">Parte '+PARTI[parte][1]+' · '+PARTI[parte][2]+'</button>' : '')+
    '</div>';
}
function disegnaSfoglio(attiva){
  let h = '<button class="unghia casa'+(attiva===null?' qui':'')+'" data-vai="#/">Indice</button>';
  Object.keys(PARTI).forEach(function(k){
    h += '<button class="unghia'+(attiva===k?' qui':'')+'" data-vai="#/'+k+'">'+
      '<span class="rom">'+PARTI[k][1]+'</span>'+PARTI[k][2]+'</button>';
  });
  $('sfoglio').innerHTML = h;
}
function voce(num, tit, des, fin, href){
  return '<button class="voce" data-vai="'+href+'">'+
    '<span class="voce-num">'+num+'</span>'+
    '<span><span class="voce-tit">'+tit+'</span>'+(des?'<span class="voce-des">'+des+'</span>':'')+'</span>'+
    '<span class="voce-fin">'+(fin||'')+'</span></button>';
}

V.home = function(){
  const nSalv = Object.keys(salvati).length;
  const conta = {principi:PRINCIPI.length+' voci', muscoli:MUSCOLI.length+' schede', problemi:PROBLEMI.length+' casi',
    studi:STUDI.length+' voci', miti:MITI.length+' voci', fonti:FONTI.length+' archivi',
    strumenti:GLOSSARIO.length+' voci', note:nSalv+' salvati'};
  const des = {
    principi:'Meccanica e biologia: momenti, curve di resistenza, lunghezza e tensione, posizione delle articolazioni.',
    muscoli:'Anatomia funzionale, meccanica, posizione articolare, esercizi ordinati per funzione, errori ricorrenti.',
    problemi:'Dal sintomo alle cause probabili alle soluzioni, in ordine di resa.',
    studi:'Libreria con identificativo verificato, e ricerca diretta negli archivi.',
    miti:'Affermazioni correnti messe a confronto con la letteratura.',
    fonti:'Dove cercare, con interrogazioni già impostate.',
    strumenti:'Glossario dei termini e quattro calcoli ricorrenti.',
    note:'Studi messi da parte e annotazioni personali.'};
  let h = '<h1 style="font-size:34px;margin-bottom:10px;">Atlante<br>dell’allenamento</h1>'+
    '<p class="sommario" style="font-size:16px;">Opera di consultazione sulla biomeccanica, sulla casistica di sala e sulla letteratura. '+
    'Ogni affermazione porta la propria sigla di evidenza; ogni studio citato ha un identificativo verificato.</p>'+
    '<h2>Indice generale</h2><div class="indice">';
  Object.keys(PARTI).forEach(function(k){
    h += voce(PARTI[k][1], PARTI[k][2], des[k], conta[k], '#/'+k);
  });
  h += '</div>';
  h += '<h2>Sigle di evidenza</h2><div class="dati legenda">'+
    '<div><dt class="l-a">A</dt><dd>'+LIV_D.A+'</dd></div>'+
    '<div><dt class="l-b">B</dt><dd>'+LIV_D.B+'</dd></div>'+
    '<div><dt class="l-c">C</dt><dd>'+LIV_D.C+'</dd></div>'+
    '<div><dt class="l-m">M</dt><dd>'+LIV_D.M+'</dd></div></div>';
  h += '<div class="colophon">Circa l’ottanta per cento dei partecipanti in questa letteratura non è allenato, '+
    'e gli effetti si comprimono nei soggetti esperti: le direzioni restano affidabili, le grandezze no. '+
    'I riassunti sono una lettura, non la fonte: accanto a ciascuno c’è il rimando all’originale.</div>';
  return h;
};

V.principi = function(){
  const gruppi = {};
  PRINCIPI.forEach(function(x, i){ (gruppi[x.gruppo] = gruppi[x.gruppo] || []).push([x, i+1]); });
  let h = testa('principi','Principi','Perché un esercizio funziona, prima di quale esercizio scegliere. Momenti e bracci di leva, curve di resistenza, relazione fra lunghezza e tensione, posizione delle articolazioni.');
  Object.keys(gruppi).forEach(function(g){
    h += '<h2>'+g+'</h2><div class="indice">';
    gruppi[g].forEach(function(par){
      h += voce(numSez('principi',par[1]), par[0].t, par[0].sommario, '', '#/principio/'+par[0].id);
    });
    h += '</div>';
  });
  return h;
};

V.principio = function(id){
  const i = indiceDi(PRINCIPI, id);
  const x = PRINCIPI.filter(function(y){ return y.id===id; })[0];
  if(!x) return V.principi();
  let h = indietro('#/principi','Principi') + testa('principi', x.t, '', numSez('principi', i));
  h += '<p class="sommario">'+x.sommario+' '+sigla(x.liv)+'</p>';
  h += '<div class="prosa saggio">' + x.corpo.map(function(par){
    return '<p>'+gr(par)+'</p>';
  }).join('') + '</div>';
  const st = studiById(x.studi);
  if(st.length) h += '<h2>Riferimenti</h2>' + st.map(studioRiga).join('');
  return h;
};

V.muscoli = function(){
  const gruppi = {};
  MUSCOLI.forEach(function(m, i){ (gruppi[m.gruppo] = gruppi[m.gruppo] || []).push([m, i+1]); });
  let h = testa('muscoli','Muscoli','Una scheda per gruppo: cosa determina lo stimolo, quali esercizi coprono quale funzione, e a che lunghezza il muscolo lavora nel tratto più caricato.');
  Object.keys(gruppi).forEach(function(g){
    h += '<h2>'+g+'</h2><div class="indice">';
    gruppi[g].forEach(function(par){
      h += voce(numSez('muscoli',par[1]), par[0].nome, par[0].funzioni[0], par[0].esercizi.length+' es.', '#/muscolo/'+par[0].id);
    });
    h += '</div>';
  });
  return h;
};

V.muscolo = function(id){
  const i = indiceDi(MUSCOLI, id);
  const m = MUSCOLI.filter(function(x){ return x.id===id; })[0];
  if(!m) return V.muscoli();
  let h = indietro('#/muscoli','Muscoli') + testa('muscoli', m.nome, '', numSez('muscoli', i));
  h += '<div class="dati">'+
    '<div><dt>Gruppo</dt><dd>'+m.gruppo+'</dd></div>'+
    '<div><dt>Capi</dt><dd>'+m.capi.join('<br>')+'</dd></div>'+
    '<div><dt>Funzioni</dt><dd>'+m.funzioni.join('<br>')+'</dd></div>'+
    '<div><dt>Volume</dt><dd>'+m.volume+'</dd></div></div>';
  h += '<h2>Cosa determina lo stimolo</h2><p>'+gr(m.stimolo)+'</p>';
  if(m.meccanica){
    h += '<h2>Meccanica '+sigla('M')+'</h2><div class="prosa"><p>'+
      gr(m.meccanica)+'</p></div>';
  }
  if(m.posizione && m.posizione.length){
    h += '<h2>Posizione articolare</h2><div class="artic">';
    m.posizione.forEach(function(v){
      const t = gr(v);
      const et = (v.match(/^\*\*([^*]+)\*\*/) || [null,''])[1];
      h += '<div><div class="marg">'+et+'</div><div class="artic-t">'+
        t.replace(/^<strong>[^<]+<\/strong>\s*/,'')+'</div></div>';
    });
    h += '</div>';
  }
  h += '<h2>Esercizi per funzione</h2>'+
    '<p class="guida">Il grado indica quanto l’esercizio serve questo muscolo: A primario, B utile, C marginale.</p>';
  m.esercizi.forEach(function(e){
    h += '<div class="es"><span class="es-g g-'+e.g+'">'+e.g+'</span>'+
      '<span><span class="es-n">'+e.n+'</span><span class="es-f">'+e.f+'</span>'+
      (e.nota ? '<span class="es-nota">'+gr(e.nota)+'</span>' : '')+'</span>'+
      '<span class="es-len">'+e.l+'</span></div>';
  });
  h += '<h2>Errori che costano</h2><div class="num-el">';
  m.errori.forEach(function(e){
    h += '<div class="num-v"><div><div class="num-t">'+e.t+sigla(e.liv)+'</div><div class="num-s">'+gr(e.s)+'</div></div></div>';
  });
  h += '</div>';
  const st = studiById(m.studi);
  if(st.length) h += '<h2>Riferimenti</h2>' + st.map(studioRiga).join('');
  return h;
};

V.problemi = function(){
  let h = testa('problemi','Problemi','Si parte dal sintomo. Le cause sono ordinate da più a meno probabile, le soluzioni da quella che risolve più spesso a quella di ripiego.')+
    '<div class="indice">';
  PROBLEMI.forEach(function(p, i){
    h += voce(numSez('problemi',i+1), p.t, p.area, p.soluzioni.length+' sol.', '#/problema/'+p.id);
  });
  return h + '</div>';
};

V.problema = function(id){
  const i = indiceDi(PROBLEMI, id);
  const p = PROBLEMI.filter(function(x){ return x.id===id; })[0];
  if(!p) return V.problemi();
  let h = indietro('#/problemi','Problemi') + testa('problemi', p.t, p.area, numSez('problemi', i));
  h += '<h2>Come si presenta</h2><p>'+gr(p.sintomo)+'</p>';
  h += '<h2>Cause probabili</h2><div class="num-el">';
  p.cause.forEach(function(c){
    h += '<div class="num-v"><div><div class="num-s">'+gr(c.c)+' '+sigla(c.liv)+'</div></div></div>';
  });
  h += '</div><h2>Soluzioni</h2><div class="num-el">';
  p.soluzioni.forEach(function(s){
    h += '<div class="num-v"><div><div class="num-t">'+gr(s.s)+sigla(s.liv)+'</div><div class="num-s">'+gr(s.come)+'</div></div></div>';
  });
  h += '</div>';
  if(p.quando_fermarsi) h += '<h2>Quando fermarsi</h2><p>'+gr(p.quando_fermarsi)+'</p>';
  const st = studiById(p.studi);
  if(st.length) h += '<h2>Riferimenti</h2>' + st.map(studioRiga).join('');
  return h;
};

let filtroTema = 'tutti';
V.studi = function(){
  const temi = ['tutti'].concat(Object.keys(STUDI.reduce(function(a,s){ a[s.tema]=1; return a; }, {})).sort());
  let h = testa('studi','Studi', STUDI.length+' voci con identificativo verificato uno per uno. Il riassunto è una lettura: la fonte è sempre a un tocco, per controllarla.');
  h += '<div class="bottoni" style="margin:0 0 20px;"><button class="bottone largo" data-vai="#/ricerca">Cerca negli archivi →</button></div>';
  h += '<div class="filtri">' + temi.map(function(t){
    return '<button class="filtro'+(t===filtroTema?' acceso':'')+'" data-tema="'+t+'">'+t+'</button>';
  }).join('') + '</div>';
  STUDI.forEach(function(s, i){
    if(filtroTema!=='tutti' && s.tema!==filtroTema) return;
    h += '<div class="studio" data-vai="#/studio/'+s.id+'">'+
      '<div class="marg">'+sigla(s.liv)+'<div style="margin-top:6px;">'+numSez('studi',i+1)+'</div></div>'+
      '<div><div class="studio-t">'+esc(s.titolo)+'</div>'+
        '<div class="studio-r"><span class="marca">'+esc(s.tema)+'</span>'+
          (s.oa?'<span class="marca aperto">testo libero</span>':'')+
          '<span class="marca">'+s.cit+' cit.</span></div>'+
        '<div class="studio-r" style="margin-top:3px;">'+esc(s.autore)+', '+esc(s.rivista)+', '+s.anno+'</div>'+
        '<div class="studio-s">'+gr(s.sintesi)+'</div></div></div>';
  });
  return h;
};

V.studio = function(id){
  const i = indiceDi(STUDI, id);
  const s = STUDI.filter(function(x){ return x.id===id; })[0];
  if(!s) return V.studi();
  const chiave = 'pmid:'+s.pmid, salvo = !!salvati[chiave];
  let h = indietro('#/studi','Studi') + testa('studi', esc(s.titolo), '', numSez('studi', i));
  h += '<div class="dati">'+
    '<div><dt>Autore</dt><dd>'+esc(s.autore)+'</dd></div>'+
    '<div><dt>Rivista</dt><dd>'+esc(s.rivista)+', '+s.anno+'</dd></div>'+
    '<div><dt>Tema</dt><dd>'+esc(s.tema)+'</dd></div>'+
    '<div><dt>Evidenza</dt><dd>'+sigla(s.liv)+' &nbsp;'+LIV_D[s.liv]+'</dd></div>'+
    '<div><dt>PMID</dt><dd class="macchina">'+esc(s.pmid)+'</dd></div>'+
    (s.doi?'<div><dt>DOI</dt><dd class="macchina" style="word-break:break-all;font-size:13px;">'+esc(s.doi)+'</dd></div>':'')+
    '<div><dt>Citazioni</dt><dd>'+s.cit+(s.oa?' · testo completo libero':'')+'</dd></div></div>';
  h += '<h2>Cosa dice</h2><p>'+gr(s.sintesi)+'</p>';
  h += '<div class="bottoni">'+
    '<a class="bottone" style="flex:1;text-align:center;line-height:40px;border-bottom-width:1px;" href="https://pubmed.ncbi.nlm.nih.gov/'+esc(s.pmid)+'/" target="_blank" rel="noopener">Vedi su PubMed</a>'+
    '<button class="bottone'+(salvo?' pieno':'')+'" data-salva="'+chiave+'" data-tit="'+esc(s.titolo)+'" data-rif="'+esc(s.pmid)+'">'+(salvo?'Salvato':'Salva')+'</button></div>';
  h += '<h2>Abstract originale</h2><div id="abs"><div class="attesa">carico…</div></div>';
  h += '<h2>Annotazioni</h2>'+
    '<textarea class="ta" id="nota" data-k="'+chiave+'" placeholder="Cosa ti serve ricordare di questo studio…">'+esc(note[chiave]||'')+'</textarea>'+
    '<div class="bottoni"><button class="bottone largo" id="salvanota">Salva annotazione</button></div>';
  setTimeout(function(){ caricaAbstract(s.pmid); }, 0);
  return h;
};

function rendiAbstract(txt){
  return abstractSezioni(txt).map(function(p){
    return '<div class="abs-sez"><div class="abs-et">'+esc(etIt(p.e))+'</div><div class="abs-tx">'+esc(p.c)+'</div></div>';
  }).join('');
}
function caricaAbstract(pmid){
  const box = $('abs'); if(!box) return;
  pubmedCercaGrezza('EXT_ID:'+pmid+' AND SRC:MED').then(function(res){
    if(!box.isConnected) return;
    const r = res[0];
    if(!r || !r.abstractText){ box.innerHTML = '<div class="vuoto">Abstract non disponibile in formato leggibile.</div>'; return; }
    box.innerHTML = rendiAbstract(r.abstractText);
  }).catch(function(e){
    if(box.isConnected) box.innerHTML = '<div class="vuoto">Archivio non raggiungibile.<br>'+esc(e.message)+'</div>';
  });
}

V.miti = function(){
  let h = testa('miti','Miti','Affermazioni che sentirai in sala, con il verdetto della letteratura e il rimando alla fonte.');
  MITI.forEach(function(m, i){
    h += '<div class="mito"><div class="marg">'+numSez('miti',i+1)+'<div style="margin-top:6px;">'+sigla(m.liv)+'</div></div>'+
      '<div><div class="mito-c">«'+gr(m.m)+'»</div>'+
      '<div class="studio-r" style="margin:0 0 8px;"><span class="verdetto v-'+m.v+'">'+m.v+'</span></div>'+
      '<div class="num-s">'+gr(m.s)+'</div>';
    const st = studiById(m.studi);
    if(st.length) h += '<div style="margin-top:10px;">' + st.map(studioRiga).join('') + '</div>';
    h += '</div></div>';
  });
  return h;
};

V.fonti = function(){
  let h = testa('fonti','Fonti','Dove cercare quando l’atlante non basta. Le interrogazioni pronte sono già impostate sugli argomenti di questa raccolta.');
  FONTI.forEach(function(f, i){
    h += '<div class="mito"><div class="marg">'+numSez('fonti',i+1)+'</div><div>'+
      '<h3>'+f.n+'</h3><p style="font-size:14.5px;color:var(--inchiostro-2);">'+f.cosa+'</p>'+
      '<div class="bottoni" style="margin:10px 0 0;"><a class="bottone largo" style="text-align:center;line-height:40px;border-bottom-width:1px;" href="'+f.url+'" target="_blank" rel="noopener">Apri</a></div>';
    if(f.q.length){
      h += '<div style="margin-top:14px;border-top:1px solid var(--filo);">';
      f.q.forEach(function(q){
        h += '<div class="es" style="grid-template-columns:1fr auto;"><a class="es-n" style="border:none;font-size:14.5px;" href="'+q[1]+'" target="_blank" rel="noopener">'+q[0]+'</a><span class="es-len">apri</span></div>';
      });
      h += '</div>';
    }
    h += '</div></div>';
  });
  return h;
};

V.strumenti = function(){
  let h = testa('strumenti','Strumenti','');
  h += '<h2>Calcoli</h2>' + CALCOLI;
  h += '<h2>Glossario</h2><div class="gloss">';
  GLOSSARIO.forEach(function(g){ h += '<div><dt>'+g.t+'</dt><dd>'+g.d+'</dd></div>'; });
  return h + '</div>';
};

const CALCOLI =
'<div class="calc"><h3>Massimale stimato</h3>'+
  '<div class="calc-riga"><span class="calc-et">Peso<span class="calc-nota">chilogrammi sollevati</span></span><input class="calc-in" id="c1w" type="text" inputmode="decimal" value="100"></div>'+
  '<div class="calc-riga"><span class="calc-et">Ripetizioni</span><input class="calc-in" id="c1r" type="text" inputmode="numeric" value="8"></div>'+
  '<div class="calc-riga"><span class="calc-et">RIR<span class="calc-nota">ripetizioni che restavano</span></span><input class="calc-in" id="c1rir" type="text" inputmode="numeric" value="1"></div>'+
  '<div class="calc-out" id="c1out"></div>'+
  '<p class="guida" style="margin-top:12px;">Epley e Brzycki sono formule diverse: se divergono molto sei fuori dall’intervallo in cui sono attendibili, indicativamente sotto le dodici ripetizioni.</p></div>'+
'<div class="calc"><h3>Volume settimanale di un muscolo</h3>'+
  '<div class="calc-riga"><span class="calc-et">Serie dirette<span class="calc-nota">il muscolo è il bersaglio</span></span><input class="calc-in" id="c2d" type="text" inputmode="numeric" value="9"></div>'+
  '<div class="calc-riga"><span class="calc-et">Serie indirette<span class="calc-nota">partecipa ma non è il bersaglio</span></span><input class="calc-in" id="c2i" type="text" inputmode="numeric" value="8"></div>'+
  '<div class="calc-out" id="c2out"></div><div class="scala"><i id="c2bar"></i></div>'+
  '<p class="guida" style="margin-top:12px;">Le indirette contano mezza serie, secondo la convenzione del volume frazionale. Riferimento per un allenato: dieci-venti serie a settimana.</p></div>'+
'<div class="calc"><h3>Carico per un altro numero di ripetizioni</h3>'+
  '<div class="calc-riga"><span class="calc-et">Peso attuale</span><input class="calc-in" id="c3w" type="text" inputmode="decimal" value="100"></div>'+
  '<div class="calc-riga"><span class="calc-et">Ripetizioni attuali</span><input class="calc-in" id="c3r" type="text" inputmode="numeric" value="8"></div>'+
  '<div class="calc-riga"><span class="calc-et">Ripetizioni bersaglio</span><input class="calc-in" id="c3t" type="text" inputmode="numeric" value="12"></div>'+
  '<div class="calc-out" id="c3out"></div>'+
  '<p class="guida" style="margin-top:12px;">A parità di massimale stimato. Serve a cambiare intervallo senza perdere il filo della progressione.</p></div>'+
'<div class="calc"><h3>Percentuale di massimale</h3>'+
  '<div class="calc-riga"><span class="calc-et">Ripetizioni</span><input class="calc-in" id="c4r" type="text" inputmode="numeric" value="8"></div>'+
  '<div class="calc-riga"><span class="calc-et">RIR</span><input class="calc-in" id="c4rir" type="text" inputmode="numeric" value="2"></div>'+
  '<div class="calc-out" id="c4out"></div>'+
  '<p class="guida" style="margin-top:12px;">Stima a quale percentuale del massimale stai lavorando. La stima del RIR è sistematicamente ottimista: vedi '+'§3'+'.</p></div>';

function num(id){ const e=$(id); return e ? (parseFloat(String(e.value).replace(',','.'))||0) : 0; }
function usc(v,e){ return '<div><div class="out-v">'+v+'</div><div class="out-e">'+e+'</div></div>'; }
function r1(x){ return Math.round(x*10)/10; }
function calcola(){
  if($('c1out')){
    const w=num('c1w'), r=num('c1r')+num('c1rir');
    const ep = r>0 ? w*(1+r/30) : 0;
    const br = (r>0 && r<37) ? w/(1.0278-0.0278*r) : 0;
    $('c1out').innerHTML = usc(r1(ep),'Epley, kg') + usc(r1(br),'Brzycki, kg') + usc(r1((ep+br)/2),'Media');
  }
  if($('c2out')){
    const tot = num('c2d') + num('c2i')*0.5;
    let g='sotto la soglia utile', cls='scarso';
    if(tot>=10 && tot<=20){ g='fascia produttiva'; cls=''; }
    else if(tot>20){ g='oltre: resa bassa, fatica alta'; cls='avviso'; }
    $('c2out').innerHTML = usc(r1(tot),'Serie frazionali') + usc(g,'Giudizio');
    $('c2bar').style.width = Math.min(100, tot/24*100)+'%';
    $('c2bar').className = cls;
  }
  if($('c3out')){
    const w=num('c3w'), r=num('c3r'), t=num('c3t');
    const e1 = r>0 ? w*(1+r/30) : 0, nw = t>0 ? e1/(1+t/30) : 0;
    $('c3out').innerHTML = usc(r1(nw),'Peso, kg') + usc((nw>w?'+':'')+r1(nw-w),'Differenza') + usc(r1(e1),'Massimale');
  }
  if($('c4out')){
    const r=num('c4r')+num('c4rir');
    $('c4out').innerHTML = usc(Math.round(r>0?100/(1+r/30):0)+'%','Del massimale') + usc(r1(r),'Rip. equivalenti');
  }
}

V.note = function(){
  const k = Object.keys(salvati);
  let h = testa('note','Note','');
  if(!k.length) return h + '<div class="vuoto">Non hai ancora messo da parte nulla.<br>Da qualunque studio, tocca Salva.</div>';
  h += '<p class="guida">'+k.length+' element'+(k.length===1?'o':'i')+'.</p>';
  k.sort(function(a,b){ return (salvati[b].quando||0)-(salvati[a].quando||0); }).forEach(function(c, i){
    const s = salvati[c], loc = STUDI.filter(function(x){ return 'pmid:'+x.pmid===c; })[0];
    h += '<div class="mito"><div class="marg">'+numSez('note',i+1)+'</div><div>'+
      '<div class="studio-t"'+(loc?' data-vai="#/studio/'+loc.id+'"':'')+'>'+esc(s.titolo)+'</div>'+
      '<div class="studio-r">PMID '+esc(s.rif)+(loc?' · in libreria':' · dagli archivi')+'</div>'+
      (note[c] ? '<div class="num-s" style="border-left:1px solid var(--filo-2);padding-left:12px;margin-top:10px;">'+esc(note[c])+'</div>' : '')+
      '<div class="bottoni"><a class="bottone" style="flex:1;text-align:center;line-height:40px;border-bottom-width:1px;" href="https://pubmed.ncbi.nlm.nih.gov/'+esc(s.rif)+'/" target="_blank" rel="noopener">PubMed</a>'+
      '<button class="bottone" data-rimuovi="'+esc(c)+'">Rimuovi</button></div></div></div>';
  });
  return h;
};

let liveQ = '', liveFiltra = true, liveOrdine = 'citazioni';
V.ricerca = function(){
  let h = indietro('#/studi','Studi') + testa('studi','Ricerca negli archivi','Interroga Europe PMC, che indicizza PubMed più i preprint.');
  h += '<div class="cerca-riga" style="padding:0;margin-bottom:14px;">'+
      '<input id="lq" type="search" placeholder="es. lengthened partials" value="'+esc(liveQ)+'">'+
      '<button class="bottone" id="lgo">Cerca</button></div>'+
    '<div class="filtri">'+
      '<button class="filtro'+(liveFiltra?' acceso':'')+'" id="lfil">contesto allenamento</button>'+
      '<button class="filtro'+(liveOrdine==='citazioni'?' acceso':'')+'" data-ord="citazioni">più citati</button>'+
      '<button class="filtro'+(liveOrdine==='recenti'?' acceso':'')+'" data-ord="recenti">più recenti</button>'+
    '</div><div id="lres"></div>';
  setTimeout(function(){
    const inp = $('lq');
    $('lgo').onclick = function(){ liveQ = inp.value; eseguiLive(); };
    inp.onkeydown = function(e){ if(e.key==='Enter'){ liveQ = inp.value; eseguiLive(); } };
    $('lfil').onclick = function(){ liveFiltra = !liveFiltra; liveCache = {}; vai('#/ricerca', true); };
    if(liveQ) eseguiLive();
  }, 0);
  return h;
};
function eseguiLive(){
  const box = $('lres'); if(!box || !liveQ.trim()) return;
  box.innerHTML = '<div class="attesa">interrogo l’archivio…</div>';
  pubmedCerca(liveQ.trim(), liveFiltra).then(function(res){
    if(!box.isConnected) return;
    if(!res.length){ box.innerHTML = '<div class="vuoto">Nessun risultato. La letteratura è in inglese: prova termini inglesi.</div>'; return; }
    box.innerHTML = '<p class="guida">'+res.length+' risultati</p>' + res.map(function(r, i){
      const jr = (r.journalInfo && r.journalInfo.journal && r.journalInfo.journal.title) || r.journalTitle || '';
      return '<div class="studio" data-live="'+esc(r.id)+'">'+
        '<div class="marg">'+(i+1)+'</div><div>'+
        '<div class="studio-t">'+esc(r.title||'')+'</div>'+
        '<div class="studio-r">'+
          (r.isOpenAccess==='Y'?'<span class="marca aperto">testo libero</span>':'')+
          (r.source==='PPR'?'<span class="marca">preprint</span>':'')+
          '<span class="marca">'+(r.citedByCount||0)+' cit.</span></div>'+
        '<div class="studio-r" style="margin-top:3px;">'+esc((r.authorString||'').split(',')[0])+', '+esc(jr)+', '+esc(annoDi(r))+'</div>'+
      '</div></div>';
    }).join('');
  }).catch(function(e){
    if(box.isConnected) box.innerHTML = '<div class="vuoto">Archivio non raggiungibile.<br>'+esc(e.message)+'</div>';
  });
}
V.live = function(id){
  let h = indietro('#/ricerca','Ricerca') + '<div id="lone"><div class="attesa">carico…</div></div>';
  setTimeout(function(){
    pubmedCercaGrezza('EXT_ID:'+id+' OR DOI:"'+id+'"').then(function(res){
      const box = $('lone'); if(!box || !box.isConnected) return;
      const r = res[0];
      if(!r){ box.innerHTML = '<div class="vuoto">Non trovato.</div>'; return; }
      const jr = (r.journalInfo && r.journalInfo.journal && r.journalInfo.journal.title) || r.journalTitle || '';
      const chiave = 'pmid:'+(r.pmid||r.id), salvo = !!salvati[chiave];
      box.innerHTML = testa('studi', esc(r.title||''), '', 'dagli archivi')+
        '<div class="dati">'+
          '<div><dt>Autori</dt><dd>'+esc(r.authorString||'')+'</dd></div>'+
          '<div><dt>Rivista</dt><dd>'+esc(jr)+', '+esc(annoDi(r))+'</dd></div>'+
          (r.pmid?'<div><dt>PMID</dt><dd class="macchina">'+esc(r.pmid)+'</dd></div>':'')+
          (r.doi?'<div><dt>DOI</dt><dd class="macchina" style="word-break:break-all;font-size:13px;">'+esc(r.doi)+'</dd></div>':'')+
          '<div><dt>Citazioni</dt><dd>'+(r.citedByCount||0)+(r.isOpenAccess==='Y'?' · testo completo libero':'')+'</dd></div></div>'+
        '<div class="bottoni">'+
          (r.pmid?'<a class="bottone" style="flex:1;text-align:center;line-height:40px;border-bottom-width:1px;" href="https://pubmed.ncbi.nlm.nih.gov/'+esc(r.pmid)+'/" target="_blank" rel="noopener">PubMed</a>':'')+
          '<button class="bottone'+(salvo?' pieno':'')+'" data-salva="'+chiave+'" data-tit="'+esc(r.title||'')+'" data-rif="'+esc(r.pmid||'')+'">'+(salvo?'Salvato':'Salva')+'</button></div>'+
        '<h2>Abstract</h2>'+
        (r.abstractText ? rendiAbstract(r.abstractText) : '<div class="vuoto">Abstract non disponibile.</div>')+
        '<h2>Annotazioni</h2><textarea class="ta" id="nota" data-k="'+chiave+'"></textarea>'+
        '<div class="bottoni"><button class="bottone largo" id="salvanota">Salva annotazione</button></div>';
      const ta = $('nota'); if(ta) ta.value = note[chiave]||'';
    });
  }, 0);
  return h;
};

V.cerca = function(q){
  const r = cercaLocale(q);
  let h = '<h1>Ricerca</h1><p class="sommario">«'+esc(q)+'» · '+r.length+' riscontri nell’atlante</p>';
  if(!r.length) h += '<div class="vuoto">Nessun riscontro per questi termini.</div>';
  else {
    const per = {};
    r.forEach(function(x){ (per[x.p] = per[x.p] || []).push(x); });
    Object.keys(PARTI).forEach(function(k){
      if(!per[k]) return;
      h += '<h2>Parte '+PARTI[k][1]+' · '+PARTI[k][2]+'</h2><div class="indice">';
      per[k].forEach(function(x){ h += voce(x.n, esc(x.t), esc(x.d), '', x.h); });
      h += '</div>';
    });
  }
  h += '<div class="bottoni" style="margin-top:24px;"><button class="bottone largo" id="tolive">Cerca «'+esc(q)+'» negli archivi →</button></div>';
  setTimeout(function(){
    const b = $('tolive');
    if(b) b.onclick = function(){ liveQ = q; vai('#/ricerca'); };
  }, 0);
  return h;
};

/* ---------------- navigazione ---------------- */
function vai(hash, sostituisci){
  if(sostituisci){ location.replace(hash); route(); } else location.hash = hash;
}
function route(){
  const parti = (location.hash || '#/').replace(/^#\/?/, '').split('/');
  const v = parti[0] || 'home', arg = decodeURIComponent(parti[1] || '');
  let html, corrente = '', parte = null;
  const cap = function(k){ parte = k; return 'Parte '+PARTI[k][1]+' · '+PARTI[k][2]; };
  if(v==='principio'){ html = V.principio(arg); corrente = cap('principi'); }
  else if(v==='muscolo'){ html = V.muscolo(arg); corrente = cap('muscoli'); }
  else if(v==='problema'){ html = V.problema(arg); corrente = cap('problemi'); }
  else if(v==='studio'){ html = V.studio(arg); corrente = cap('studi'); }
  else if(v==='live'){ html = V.live(arg); corrente = cap('studi'); }
  else if(v==='ricerca'){ html = V.ricerca(); corrente = cap('studi'); }
  else if(v==='cerca'){ html = V.cerca(arg); corrente = 'Ricerca'; parte = 'nessuna'; }
  else if(V[v] && PARTI[v]){ html = V[v](); corrente = cap(v); }
  else { html = V.home(); corrente = ''; }
  if(v !== 'home' && v !== '') html += chiusura(PARTI[parte] ? parte : null);
  $('main').innerHTML = html;
  $('corrente').textContent = corrente;
  disegnaSfoglio(parte);
  window.scrollTo(0, 0);
  calcola();
}
window.addEventListener('hashchange', route);

/* ---------------- eventi ---------------- */
document.addEventListener('click', function(ev){
  const g = ev.target.closest('[data-vai]');
  if(g){ vai(g.getAttribute('data-vai')); return; }
  const l = ev.target.closest('[data-live]');
  if(l){ vai('#/live/'+encodeURIComponent(l.getAttribute('data-live'))); return; }
  const o = ev.target.closest('[data-ord]');
  if(o){ liveOrdine = o.getAttribute('data-ord'); liveCache = {}; vai('#/ricerca', true); return; }
  const t = ev.target.closest('[data-tema]');
  if(t){ filtroTema = t.getAttribute('data-tema'); vai('#/studi', true); return; }
  const sv = ev.target.closest('[data-salva]');
  if(sv){
    const k = sv.getAttribute('data-salva');
    if(salvati[k]){ delete salvati[k]; sv.classList.remove('pieno'); sv.textContent='Salva'; avvisa('Rimosso.'); }
    else {
      salvati[k] = {tipo:'studio', titolo:sv.getAttribute('data-tit'), rif:sv.getAttribute('data-rif'), quando:Date.now()};
      sv.classList.add('pieno'); sv.textContent='Salvato'; avvisa('Messo da parte.');
    }
    if(!save(K_SALV, salvati)) avvisa('Salvato solo per questa sessione.');
    return;
  }
  const rm = ev.target.closest('[data-rimuovi]');
  if(rm){
    const k = rm.getAttribute('data-rimuovi');
    delete salvati[k]; delete note[k];
    save(K_SALV, salvati); save(K_NOTE, note);
    vai('#/note', true); avvisa('Rimosso.');
    return;
  }
  if(ev.target.id==='salvanota'){
    const ta = $('nota'); if(!ta) return;
    const k = ta.getAttribute('data-k');
    if(ta.value.trim()) note[k] = ta.value.trim(); else delete note[k];
    avvisa(save(K_NOTE, note) ? 'Annotazione salvata.' : 'Salvata solo per questa sessione.');
  }
});
document.addEventListener('input', function(ev){
  if(ev.target.classList && ev.target.classList.contains('calc-in')) calcola();
});

let tq = null;
$('q').addEventListener('input', function(e){
  const val = e.target.value;
  clearTimeout(tq);
  tq = setTimeout(function(){
    if(val.trim().length >= 2) vai('#/cerca/'+encodeURIComponent(val.trim()), true);
    else if((location.hash||'').indexOf('#/cerca') === 0) vai('#/', true);
  }, 260);
});
$('marchio').addEventListener('click', function(){ $('q').value=''; vai('#/'); });
/* la ricerca non e' una parte dell'opera: la striscia non evidenzia nulla */

/* Giorno e notte: l'atlante si legge in sala e sul divano. */
const K_TEMA = 'atlante-tema';
function applicaTema(t){
  document.documentElement.setAttribute('data-tema', t);
  $('tema').textContent = t==='notte' ? 'Giorno' : 'Notte';
  const m = document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute('content', t==='notte' ? '#15161a' : '#f4f2ec');
}
let tema = 'giorno';
try{ tema = localStorage.getItem(K_TEMA) || 'giorno'; }catch(e){}
applicaTema(tema);
$('tema').addEventListener('click', function(){
  tema = tema==='notte' ? 'giorno' : 'notte';
  applicaTema(tema);
  try{ localStorage.setItem(K_TEMA, tema); }catch(e){}
});

route();

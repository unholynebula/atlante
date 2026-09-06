#!/usr/bin/env python3
"""Verifica dell'archivio. Tre controlli, tutti contro la fonte originale:

  1. ogni PMID citato risolve davvero su PubMed;
  2. il titolo memorizzato corrisponde a quello del PMID  (scopre le citazioni
     agganciate allo studio sbagliato: corrigendum, lettere di risposta, omonimi);
  3. ogni cifra scritta nella sintesi compare nell'abstract di quello studio
     (i numeri scritti a lettere nell'abstract vengono convertiti, e le somme
     legittime — 12 uomini + 6 donne = 18 — vanno controllate a mano).

Uso:  python3 verifica_pmid.py
"""
import json, io, os, re, time, urllib.request, urllib.parse

os.chdir(os.path.dirname(os.path.abspath(__file__)))
s = io.open('data-studi.js', encoding='utf-8').read()
i = s.index('const STUDI = ['); j = s.index('\n];', i)
STUDI = json.loads(s[s.index('[', i): j+2])

def apri(url):
    with urllib.request.urlopen(url, timeout=45) as r:
        return json.load(r)

# ---- 1. i PMID risolvono, e recupero gli abstract ----
ABS = {}; ko = []
ids = [x['pmid'] for x in STUDI]
for k in range(0, len(ids), 25):
    lotto = ids[k:k+25]
    q = '(' + ' OR '.join('EXT_ID:'+p for p in lotto) + ') AND SRC:MED'
    d = apri("https://www.ebi.ac.uk/europepmc/webservices/rest/search?query="
             + urllib.parse.quote(q) + "&format=json&pageSize=100&resultType=core")
    trovati = set()
    for x in d['resultList']['result']:
        trovati.add(x.get('pmid'))
        ABS[x.get('pmid')] = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', x.get('abstractText') or ''))
    ko += [p for p in lotto if p not in trovati]
    time.sleep(0.35)

# ---- 2. i titoli corrispondono ----
def norm(t):
    return re.sub(r'[^a-z0-9]+', ' ', re.sub(r'<[^>]+>', ' ', t or '').lower()).strip()
reali = {}
for k in range(0, len(ids), 40):
    d = apri('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?'
             + urllib.parse.urlencode({'db': 'pubmed', 'id': ','.join(ids[k:k+40]), 'retmode': 'json'}))
    reali.update({k2: v.get('title', '') for k2, v in d.get('result', {}).items() if k2 != 'uids'})
    time.sleep(0.35)
titoli_ko = []
for x in STUDI:
    vero = reali.get(x['pmid'], '')
    if not vero: continue
    A = set(w for w in norm(x['titolo']).split() if len(w) > 3)
    B = set(w for w in norm(vero).split() if len(w) > 3)
    if len(A & B) / max(1, len(A | B)) < 0.7:
        titoli_ko.append((x['id'], x['titolo'][:60], vero[:60]))

# ---- 3. le cifre delle sintesi compaiono nell'abstract ----
U = {'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,
     'eleven':11,'twelve':12,'thirteen':13,'fourteen':14,'fifteen':15,'sixteen':16,
     'seventeen':17,'eighteen':18,'nineteen':19}
T = {'twenty':20,'thirty':30,'forty':40,'fifty':50,'sixty':60,'seventy':70,'eighty':80,'ninety':90}
def a_lettere(t):
    tok = re.findall(r'[a-z]+', t.lower()); out = set(); k = 0
    while k < len(tok):
        if tok[k] in U or tok[k] in T:
            tot = cur = 0; start = k
            while k < len(tok):
                w = tok[k]
                if w in U: cur += U[w]
                elif w in T: cur += T[w]
                elif w == 'hundred': cur = (cur or 1) * 100
                elif w == 'thousand': tot += (cur or 1) * 1000; cur = 0
                elif w == 'and' and k+1 < len(tok) and (tok[k+1] in U or tok[k+1] in T): pass
                else: break
                k += 1
            if k > start: out.add(tot + cur)
        else: k += 1
    return out
def presente(num, t, lettere):
    t2 = t.replace(',', '.')
    for c in {num, num.replace(',', '.'), num.replace('.', ','), num.replace('.', '')}:
        if c and re.search(r'(?<![\d.])' + re.escape(c) + r'(?![\d])', t2): return True
    try:
        v = float(num.replace(',', '.'))
        if any(abs(float(m) - v) < 1e-9 for m in re.findall(r'\d+(?:\.\d+)?', t2)): return True
        if v == int(v) and int(v) in lettere: return True
    except ValueError: pass
    return False
cifre_ko = []
da_testo_pieno = []
senza_abs = []
for x in STUDI:
    a = ABS.get(x['pmid'], '')
    if not a:
        senza_abs.append(x['id']); continue
    L = a_lettere(a)
    nums = [n for n in re.findall(r'\d+(?:[,.]\d+)?', x['sintesi']) if not re.match(r'^(19|20)\d\d$', n)]
    manc = [n for n in nums if not presente(n, a, L)]
    if not manc: continue
    # Alcune voci dichiarano che le cifre vengono dal testo completo (tipico dei
    # documenti di posizione, il cui abstract omette dosi e protocolli).
    if x.get('cifre_da_testo_completo'): da_testo_pieno.append((x['id'], manc))
    else: cifre_ko.append((x['id'], manc))

print('%d studi in archivio' % len(STUDI))
print('1. PMID          : %s' % ('tutti risolvono' if not ko else 'NON RISOLTI: %s' % ko))
print('2. titoli        : %s' % ('tutti corrispondono' if not titoli_ko else 'DISCORDANTI:'))
for i2, mio, vero in titoli_ko:
    print('     %-22s mio: %s\n     %-22s vero: %s' % (i2, mio, '', vero))
print('3. cifre         : %d studi da controllare a mano%s'
      % (len(cifre_ko), '' if not cifre_ko else ' (somme nostre e rimandi ad altri studi sono attesi)'))
for i2, m in cifre_ko:
    print('     %-22s %s' % (i2, ', '.join(m)))
if da_testo_pieno:
    print('   cifre dichiarate dal testo completo, non dall\'abstract (%d):' % len(da_testo_pieno))
    for i2, m in da_testo_pieno:
        print('     %-22s %s' % (i2, ', '.join(m)))
print('   senza abstract in archivio (%d): %s' % (len(senza_abs), ', '.join(senza_abs) or '—'))

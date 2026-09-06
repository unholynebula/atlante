#!/usr/bin/env python3
"""Controlla che ogni PMID citato risolva davvero su PubMed."""
import json, io, os, urllib.request, urllib.parse, time
os.chdir(os.path.dirname(os.path.abspath(__file__)))
s = io.open('data-studi.js', encoding='utf-8').read()
i = s.index('const STUDI = ['); j = s.index('\n];', i)
S = json.loads(s[s.index('[', i): j+2])
ids = [x['pmid'] for x in S]; ko = []
for k in range(0, len(ids), 40):
    lotto = ids[k:k+40]
    url = ("https://www.ebi.ac.uk/europepmc/webservices/rest/search?query="
           + urllib.parse.quote('(' + ' OR '.join('EXT_ID:'+p for p in lotto) + ') AND SRC:MED')
           + "&format=json&pageSize=100")
    with urllib.request.urlopen(url, timeout=40) as r:
        trovati = set(x.get('pmid') for x in json.load(r)['resultList']['result'])
    ko += [p for p in lotto if p not in trovati]
    time.sleep(0.4)
print('%d PMID controllati — %s' % (len(ids), 'tutti verificati' if not ko else 'NON RISOLTI: %s' % ko))

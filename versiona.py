#!/usr/bin/env python3
"""Ricalcola le impronte dei file in index.html: senza, il browser continua
a servire la versione vecchia dalla cache dopo ogni modifica."""
import io, re, hashlib, sys, os
os.chdir('/Users/matteocamerini/Claude/atlante')
s = io.open('index.html', encoding='utf-8').read()
for f in ['style.css','data-principi.js','data-studi.js','data-muscoli.js','data-contenuti.js','app.js']:
    v = hashlib.md5(io.open(f,'rb').read()).hexdigest()[:8]
    s = re.sub(r'(href|src)="'+re.escape(f)+r'(\?v=[0-9a-f]+)?"',
               lambda m, f=f, v=v: '%s="%s?v=%s"' % (m.group(1), f, v), s)
io.open('index.html','w',encoding='utf-8').write(s)
print('impronte aggiornate')

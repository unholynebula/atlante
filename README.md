# Atlante

Riferimento sull'allenamento basato sulla ricerca. Web app statica, pensata per iPhone.

## Avvio

Nessuna dipendenza, nessun server applicativo. Serve solo un server statico,
perché la ricerca live usa `fetch` (che da `file://` non funziona):

    python3 -m http.server 8000

poi apri `http://localhost:8000` e, da iPhone, "Aggiungi a Home".

## File

| File | Contenuto |
|---|---|
| `index.html` | Scheletro della pagina |
| `icon-*.png`, `apple-touch-icon.png` | Icone generate: tre barre nei colori dei livelli di evidenza |
| `style.css` | Impaginazione da manuale stampato: carta chiara, testo in grazie, sezioni numerate, colonna di margine. Il colore è riservato alle sigle di evidenza |
| `app.js` | Navigazione su hash, viste, ricerca locale, ricerca live, calcolatori, salvataggi |
| `data-studi.js` | 109 studi con PMID verificato, tema, livello di evidenza e riassunto |
| `data-muscoli.js` | 18 schede di biomeccanica, 144 esercizi mappati per funzione e lunghezza |
| `data-contenuti.js` | 28 problemi, 28 miti, 60 voci di glossario, 18 archivi con ricerche pronte |

## Impianto

Sette parti numerate (§1 Muscoli … §7 Note), ognuna con titolo corrente
in testa alla pagina e numero di sezione su ogni voce. La navigazione è su
hash, così il tasto indietro dell'iPhone funziona.

Due modi di lettura, giorno e notte, con la preferenza ricordata.

## Sigle di evidenza

- **A** — meta-analisi, oppure più studi concordi su soggetti allenati
- **B** — studio singolo controllato, o evidenza indiretta solida
- **C** — meccanismo plausibile o consenso pratico, non testato direttamente

## Ricerca live

Usa l'API pubblica di [Europe PMC](https://europepmc.org/), che indicizza PubMed
più i preprint, risponde in JSON e dichiara `access-control-allow-origin: *`.
Nessuna chiave, nessun proxy.

Le parole nude vengono qualificate su titolo e abstract e legate in AND: Europe PMC
per difetto cerca nel testo completo, e `lateral raise trapezius` senza
qualificazione restituisce 1016 risultati quasi tutti irrilevanti contro 6 pertinenti.
Le frasi tra virgolette restano nel campo predefinito, dove funzionano.

## Come aggiungere contenuto

I file `data-*.js` sono semplici array. Per aggiungere uno studio serve un PMID reale:
verificalo prima con

    curl -s 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:PMID&format=json&resultType=core'

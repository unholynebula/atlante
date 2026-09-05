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
| `data-principi.js` | 28 voci di meccanica e biologia: momenti, curve di resistenza, lunghezza-tensione, ritmo scapolo-omerale |
| `data-studi.js` | 127 studi con PMID verificato, tema, livello di evidenza e riassunto |
| `data-muscoli.js` | 18 schede: meccanica, posizione articolare, 144 esercizi mappati per funzione e lunghezza |
| `data-contenuti.js` | 44 problemi, 44 miti, 100 voci di glossario, 27 archivi con ricerche pronte |

## Impianto

Otto parti numerate (§1 Principi … §8 Note), ognuna con titolo corrente
in testa alla pagina e numero di sezione su ogni voce. La navigazione è su
hash, così il tasto indietro dell'iPhone funziona.

Due modi di lettura, giorno e notte, con la preferenza ricordata.

## Sigle di evidenza

- **A** — meta-analisi, oppure più studi concordi su soggetti allenati
- **B** — studio singolo controllato, o evidenza indiretta solida
- **C** — meccanismo plausibile o consenso pratico, non testato direttamente
- **M** — deriva dalla meccanica o dall'anatomia: non è un'ipotesi, è una conseguenza

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

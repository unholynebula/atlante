# Atlante

> Contesto completo del progetto, metodo di verifica, trappole tecniche
> gia' pagate e lavoro aperto: **[ATLANTE.md](ATLANTE.md)**.

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
| `data-principi.js` | 33 voci di meccanica e biologia: momenti, curve di resistenza, lunghezza-tensione, ritmo scapolo-omerale |
| `data-studi.js` | 140 studi con PMID verificato, tema, livello di evidenza e riassunto |
| `data-muscoli.js` | 18 schede: meccanica, posizione articolare, 284 esercizi con esecuzione dettagliata (1216 righe), mappati per funzione e lunghezza |
| `data-contenuti.js` | 48 problemi, 59 miti, 110 voci di glossario, 27 archivi con ricerche pronte |

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

## Dopo ogni modifica

I file sono richiamati con un'impronta (`app.js?v=…`) perche' il browser non
serva la versione vecchia dalla cache. Dopo aver toccato un file:

    python3 versiona.py

## Come si verifica una voce

Il metodo, in ordine:

1. il titolo si cerca su Europe PMC e deve tornare un aggancio **esatto**;
   gli agganci approssimativi si scartano
2. si recupera l'abstract e **la sintesi si scrive da quello**, non a memoria
3. ogni cifra citata deve comparire nell'abstract; se non c'e', si toglie
4. **la cifra deve anche riguardare la domanda che si sta facendo.** Non basta
   che il numero sia nel testo: va verificato di che cosa parla. Il documento
   di posizione sulla creatina nomina 3 g al giorno, ma come apporto
   *alimentare abituale per la salute generale*; la dose di integrazione per
   chi si allena e' 3-5 g dopo un carico di 0,3 g per kg. Numero giusto,
   contesto sbagliato: la citazione risultava verificata e la raccomandazione
   era falsa
5. dove serve una dose o un protocollo, si legge il **testo completo**, non
   l'abstract: gli abstract dei documenti di posizione riassumono le
   conclusioni e omettono i numeri operativi
6. le soglie devono venire dagli studi, non dal buon senso. Se nessuno ha
   provato un valore, non si mette un numero: si dice che la soglia non e'
   stabilita
7. la sintesi non deve contenere affermazioni che l'abstract non sostiene,
   nemmeno se vere: se un fatto serve ma viene da altrove, si cita altrove
8. i limiti che cambiano la lettura — popolazione non allenata, anziani, sole
   donne, campione minuscolo, protocollo particolare — vanno scritti nella
   sintesi, non sottintesi
9. dove due studi in archivio si contraddicono, lo si dice nella sintesi di
   entrambi invece di scegliere il piu' comodo

## Il controllo automatico

    python3 verifica_pmid.py

Fa tre cose, tutte contro la fonte originale:

1. **i PMID risolvono** su PubMed;
2. **i titoli corrispondono** a quelli del PMID. Serve a scoprire le citazioni
   agganciate allo studio sbagliato — un corrigendum al posto dell'articolo,
   una lettera di risposta al posto della rassegna, un omonimo;
3. **le cifre delle sintesi compaiono negli abstract**, convertendo i numeri
   che l'abstract scrive a lettere.

Il terzo controllo segnala anche casi legittimi che vanno letti a mano: somme
fatte da noi (12 uomini + 6 donne = 18), rimandi ad altri studi dell'archivio,
e abstract che Europe PMC restituisce troncati. Non e' un semaforo verde
automatico: e' una lista di cose da guardare.

## Come aggiungere contenuto

I file `data-*.js` sono semplici array. Per aggiungere uno studio serve un PMID reale:
verificalo prima con

    curl -s 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:PMID&format=json&resultType=core'

## Tavole anatomiche

Ogni scheda muscolo porta un'illustrazione: un'incisione anatomica storica
riprodotta come **due maschere PNG** — il tratto e il muscolo evidenziato.
In pagina diventano due strati colorati con i token del tema, quindi seguono
il modo giorno e il modo notte senza una seconda serie di immagini.

Le fonti sono su Wikimedia Commons: in gran parte tavole della *Gray's
Anatomy* del 1918 di Henry Vandyke Carter (pubblico dominio) e rielaborazioni
con licenza CC BY-SA 3.0. Autore e licenza sono in didascalia sotto ogni
tavola, e in `anatomia/fonti.json`.

Ogni tavola e' stata verificata in tre modi prima di entrare: fondo bianco con
tratto scuro e area rossa; descrizione su Commons che nomina il muscolo
giusto; e uso effettivo nella voce di Wikipedia di quel muscolo. Tre candidate
sono state scartate proprio da questo controllo, perche' raffiguravano un
muscolo diverso da quello atteso.

Su **avambracci** ed **erettori** la tavola disponibile non ha un muscolo
evidenziato: resta la sola incisione, e la didascalia non promette altro.

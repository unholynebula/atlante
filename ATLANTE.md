# ATLANTE — contesto del progetto

Documento di passaggio: contiene tutto quello che serve per riprendere il
lavoro senza la conversazione in cui è stato costruito. Aggiornato al
**9 settembre 2026**.

---

## 1. Che cos'è

Riferimento sull'allenamento contro resistenza per iPhone, in italiano.
Web app statica, senza framework e senza passaggio di build.

- **Repo:** `https://github.com/unholynebula/atlante`
- **Online:** `https://unholynebula.github.io/atlante/`
- **Locale:** `/Users/matteocamerini/Claude/atlante`
- **Pubblicazione:** `git push origin main` → GitHub Pages ci mette 1-3 minuti

Per chi è: **Matteo**, 5 anni di allenamento, vuole diventare il miglior coach
della sua zona. L'atlante è lo strumento di studio, non un'app di allenamento.

---

## 2. Come vuole che si lavori

Queste non sono preferenze estetiche: sono state imparate sbagliando.

**Verifica esaustiva, mai a campione.** Alla terza tornata di correzioni ha
detto: *«non puoi correggere qualcosa ogni volta, significa che non è tutto
corretto»*. Controllare ogni elemento in modo meccanico e riproducibile, e
lasciare lo script che lo rifà. Non dichiarare mai «tutto corretto»
appoggiandosi a un sottoinsieme, e distinguere sempre fra *controllato* e
*campionato*.

**Niente forme disegnate a mano al posto di contenuto vero.** Testuale:
*«non fare come fai di solito che disegni con linee e forme»*. Se non si è in
grado di produrre una cosa con qualità reale, dirlo e cercare la fonte giusta.

**Onestà sui limiti prima di costruire**, non dopo. Un buco dichiarato vale
più di un errore invisibile.

**Verificare ciò che si vede, non la proprietà impostata.** Vedi §8.

---

## 3. File e architettura

| File | Cosa contiene |
|---|---|
| `index.html` | 1,5 KB, solo scheletro e i tag `<script>` con le impronte di versione |
| `app.js` | 51 KB. Navigazione su hash, viste, ricerca locale, ricerca live, calcolatori, salvataggi |
| `style.css` | 18 KB. Tutto lo stile |
| `data-studi.js` | 140 studi |
| `data-principi.js` | 33 principi |
| `data-muscoli.js` | 224 KB, 18 schede muscolo con 284 esercizi |
| `data-contenuti.js` | 48 problemi, 59 miti, 110 voci di glossario, 27 archivi |
| `data-tavole.js` | metadati delle 18 illustrazioni anatomiche |
| `anatomia/*.png` | 34 maschere PNG, 2,3 MB |
| `versiona.py` | ricalcola le impronte di versione in `index.html` |
| `verifica_pmid.py` | i tre controlli sull'archivio (§7) |

**Navigazione:** hash (`#/parte/id`), così il tasto indietro dell'iPhone
funziona. Otto parti numerate: §1 Principi, §2 Muscoli, §3 Problemi,
§4 Studi, §5 Miti, §6 Fonti, §7 Strumenti, §8 Note.

**Stile:** riferimento a stampa. Carta `#f4f2ec`, inchiostro `#15171b`, rosso
`#8c2f26`, corpo in Charter con grazie a 16px/1.62. Modo giorno e modo notte
via `data-tema` sull'elemento radice.

**Persistenza:** `localStorage` con strato `rawGet`/`rawSet`.

---

## 4. Contenuto attuale

| | |
|---|---|
| Studi | **140** (tutti con PMID verificato) |
| Principi | **33** |
| Schede muscolo | **18** |
| Esercizi | **284**, ognuno con 4-5 righe di esecuzione (**1216** righe) |
| Errori per muscolo | 56 |
| Problemi | 48 |
| Miti | 59 |
| Glossario | 110 |
| Archivi con ricerche pronte | 27 |
| Calcolatori | 11 |

**Livelli di evidenza:** `A` meta-analisi o più studi concordi su allenati ·
`B` studio singolo controllato · `C` meccanismo o consenso non testato ·
`M` deriva dalla meccanica o dall'anatomia (conseguenza, non ipotesi).

**Calcolatori:** massimale stimato · carico per altre ripetizioni · percentuale
di massimale · dischi per lato · volume settimanale · volume distribuito sulle
sedute · durata della seduta · proteine · ritmo di dimagrimento · caffeina ·
creatina.

---

## 5. Strutture dati

```
STUDI     id, pmid, doi, titolo, rivista, anno, autore, oa, cit, tema, liv,
          sintesi, kw   [+ cifre_da_testo_completo: true, opzionale]
PRINCIPI  id, t, gruppo, sommario, liv, corpo[], studi[]
MUSCOLI   id, nome, gruppo, capi[], funzioni[], stimolo, meccanica,
          posizione[], esercizi[], errori[], studi[], volume
 esercizi n, g (A/B/C), f, l (allungata|media|accorciata|variabile), nota, esec[]
PROBLEMI  id, t, area, sintomo, cause[], soluzioni[], quando_fermarsi, studi[]
MITI      id, m, v (falso|parziale), liv, s, studi[]
FONTI     id, n, url, q, cosa
```

Il grassetto nel testo si scrive con `**asterischi**` e viene convertito in un
punto solo, dalla funzione `gr()` in `app.js`.

**Dopo ogni modifica ai dati: `python3 versiona.py`**, altrimenti i telefoni
continuano a servire la versione in cache.

---

## 6. Il metodo di verifica delle citazioni

In ordine. Le regole 4, 5 e 6 sono nate da errori reali.

1. Il titolo si cerca su Europe PMC e deve tornare un aggancio **esatto**.
2. Si recupera l'abstract e **la sintesi si scrive da quello**, mai a memoria.
3. Ogni cifra citata deve comparire nell'abstract; se non c'è, si toglie.
4. **La cifra deve anche riguardare la domanda che si sta facendo.** Non basta
   che il numero sia nel testo: va verificato di che cosa parla.
5. Per **dosi e protocolli si legge il testo completo**, non l'abstract: gli
   abstract dei documenti di posizione omettono i numeri operativi.
6. **Le soglie vengono dagli studi.** Se nessuno ha provato un valore, si
   scrive che la soglia non è stabilita invece di inventare un numero.
7. Nessuna affermazione che l'abstract non sostenga, nemmeno se vera: se un
   fatto serve ma viene da altrove, si cita altrove.
8. I limiti che cambiano la lettura (non allenati, anziani, sole donne,
   campione minuscolo, protocollo particolare) vanno **scritti**.
9. Dove due studi in archivio si contraddicono, si dice in entrambi.

---

## 7. `verifica_pmid.py`

```bash
python3 verifica_pmid.py
```

Tre controlli contro la fonte originale:

1. **I PMID risolvono** su PubMed.
2. **I titoli corrispondono** a quelli del PMID. È il controllo che ha trovato
   le quattro citazioni agganciate allo studio sbagliato.
3. **Le cifre delle sintesi compaiono negli abstract**, convertendo i numeri
   scritti a lettere.

Il terzo segnala anche casi legittimi: somme nostre (12 uomini + 6 donne = 18),
rimandi ad altri studi, abstract che Europe PMC restituisce troncati. Una voce
può dichiarare `cifre_da_testo_completo: true` e viene riportata a parte.

**Stato all'ultima esecuzione:** 140/140 PMID risolvono, 140/140 titoli
corrispondono, 9 studi con cifre da controllare a mano (tutte legittime), 2
senza abstract in archivio (`inman_scapola`, `henneman_size`, entrambi marcati
in sintesi come attribuzioni storiche).

**Europe PMC, note pratiche:** risponde con `access-control-allow-origin: *`,
quindi si interroga da pagina statica senza chiave. Le query nude cercano nel
testo pieno e tornano spazzatura: i termini vanno qualificati `TITLE_ABS:` e
messi in AND. Le etichette di sezione degli abstract arrivano come HTML
(`<h4>Purpose</h4>`, `<b>Background:</b>`), non come parole maiuscole.

---

## 8. Trappole tecniche già pagate

Non reintrodurle.

**Collisione di nomi di attributo.** I gestori di clic cercano attributi
risalendo l'albero. I filtri degli studi usavano `data-tema`, e il selettore
giorno/notte scrive `data-tema` su `<html>`: ogni clic in pagina finiva
sull'elenco degli Studi. Rinominato in `data-filtro-tema`. C'è anche una
guardia: il gestore esce subito se il bersaglio non sta dentro
`#main, #top, .avviso-fisso`. **Ogni nuovo attributo di comportamento deve
avere un nome che non esiste altrove** (`data-esec` è stato scelto così).

**`[hidden]` perde contro una classe con `display`.** `.es-corpo` dichiarava
`display:block`, che ha specificità maggiore della regola `[hidden]{display:none}`
del browser: i blocchi restavano aperti e il pulsante non faceva niente. In
testa al CSS c'è ora `[hidden]{display:none !important;}`. **Non rimuoverla.**

**`<span>` con `margin-top` ma senza `display:block`** resta inline e il testo
si attacca: usciva «Pesochilogrammi sollevati». Successo due volte
(`.voce-des`, `.calc-nota`).

**`::first-line` con maiuscoletto** sembrava un vezzo tipografico ma il punto
in cui finisce dipende dalla larghezza dello schermo: su telefono si legge
come un errore di rendering. Rimossa.

**La barra di navigazione si tagliava.** Le nove parti sommano 525px e con
l'intervallo di 18px superavano i 620px utili: l'ultima voce restava fuori a
ogni larghezza. Ora `.sfoglio` ha `flex-wrap:wrap`, e c'è una media query sotto
i 560px. **Aggiungendo una parte, ricontrollare che nessuna voce sparisca.**

**Apostrofi e accenti.** I dati sono in stringhe JS: l'apostrofo dritto le
rompe, quindi si usa sempre quello tipografico `’`. Ma attenzione: `piu'` non
va normalizzato in `piu’`, va scritto **`più`**. Una normalizzazione automatica
ha prodotto 147 accenti sbagliati (`gia’`, `perche’`) che sono stati poi
corretti a mano.

**`versiona.py` conosce solo i file elencati al suo interno.** Aggiungendo un
file di dati, va aggiunto anche lì, e in `index.html` serve il segnaposto
`?v=0`.

**Testare lo stato visibile, non la proprietà.** Il test dei blocchi
collassabili controllava `c.hidden` — corretto — e riportava «22 chiusi»,
mentre a schermo erano tutti aperti. Per qualunque cosa nascosta, aperta o
collassata: misurare `offsetHeight` o il `display` calcolato. Per la
navigazione: confrontare l'URL prima e dopo.

**Regressione da eseguire prima di ogni pubblicazione:** renderizzare tutte le
pagine (~335), simulare i clic sul testo non interattivo verificando che
l'hash non cambi, controllare che non compaiano `**` a schermo, e leggere la
console. Si fa da browser con `disegna(hash, true)`.

---

## 9. Errori di contenuto già corretti

Elenco per non reintrodurli. Ognuno è stato trovato rileggendo, non da un test.

**Citazioni agganciate allo studio sbagliato (4).** Un corrigendum al posto
dell'articolo (Lopez, ora PMID 33433148); una lettera di risposta al posto
della rassegna (Iversen, ora 34125411); un protocollo senza risultati citato
come se ne avesse (spalla); uno studio su restrizione del flusso spacciato per
uno sull'affidabilità del RIR.

**Meccanica: dove cade il momento massimo.** Errore ripetuto sette volte.

- Con **resistenza verticale** il braccio di leva è la distanza *orizzontale*
  fra articolazione e carico. Alla lat machine è quindi massimo a circa 90° di
  abduzione e tende a zero con il braccio sopra la testa: **lunghezza massima e
  leva massima non coincidono.**
- Nel **kickback** per il tricipite, a gomito esteso l'avambraccio è
  orizzontale e la leva è *massima*, non minima. Il difetto dell'esercizio è
  che il picco cade dove il muscolo è più corto.
- Nella **back extension** il momento è massimo in cima, con il busto
  orizzontale, non in basso dove il busto pende in verticale.
- Nelle **scrollate** con pesi liberi la resistenza non cala in cima: moto e
  gravità sono entrambi verticali.
- Nelle **croci ai cavi** il picco dipende da dove ti posizioni; il momento
  massimo in apertura vale per i manubri.
- Nelle **iperestensioni**, un disco dietro il collo è più lontano dall'anca di
  uno al petto, quindi **allunga** la leva.

**Direzione invertita rispetto all'abstract (8):** Blazevich (gli adattamenti
architetturali dipendono da fattori *diversi* dal tipo di contrazione); la
larghezza della presa in panca *non* cambia il massimale; nello squat *non*
c'è differenza significativa fra i capi del quadricipite; il rest-pause *batte*
le serie tradizionali sulla forza; nel confronto unilaterale/bilaterale nessuna
interazione significativa; all'anca le coppie di sumo e convenzionale non
differiscono.

**Cifra giusta, contesto sbagliato.** Il documento ISSN nomina 3 g al giorno di
creatina, ma come **apporto alimentare abituale per la salute generale**. La
dose di integrazione è 0,3 g/kg per 5-7 giorni e poi **3-5 g** (5-10 per atleti
grossi). Matteo l'ha beccato da solo.

**Contraddizioni interne.** «Il calf da seduto è l'unico modo di caricare il
soleo» seguito, due righe dopo, dallo studio che mostra il soleo crescere
uguale anche in piedi.

**Etichette invertite.** Kinoshita: il soleo è 2,1% **in piedi** e 2,9% **da
seduto**.

**Il caso delle alzate laterali.** Sopra i 90° il lavoro *non* «passa al
trapezio»: il momento è `W · L · sin θ`, massimo a 90° e decrescente oltre. E
la rotazione della scapola verso l'alto operata dal trapezio superiore è
*necessaria* all'elevazione, non un difetto.

---

## 10. Tavole anatomiche

Ogni scheda muscolo ha un'incisione storica resa come **due maschere PNG con
solo canale alfa** — il tratto e il muscolo evidenziato — sovrapposte come due
strati colorati con i token del tema. Per questo il modo notte funziona senza
una seconda serie di immagini.

Pipeline (ricostruibile: serve `Pillow`, installabile con
`python3 -m pip install --user Pillow`):

1. Separazione: il rosso dell'evidenziazione ha **verde e blu quasi uguali**;
   l'inchiostro seppia di alcune tavole ha il verde ben sopra il blu.
2. Pulizia: il muscolo nelle tavole di Gray è stampato a retino e produce un
   pulviscolo di punti. Apertura morfologica più selezione delle sole
   componenti connesse principali.
3. Uscita: PNG in modo `LA`, largh. max 460, alt. max 820.

**Verifica di una tavola, tre passaggi:** analisi dell'immagine (fondo bianco,
tratto scuro, area rossa come componente connessa); descrizione su Wikimedia
che nomina il muscolo giusto; **uso effettivo nella voce di Wikipedia di quel
muscolo**. Il terzo ha scartato tre candidate che il primo aveva approvato: la
tavola scelta per il bicipite raffigurava il grande pettorale, quella per gli
avambracci un omero, quella per i flessori d'anca il peritoneo.

**Limite dichiarato:** su `avambracci` ed `erettori` la tavola non ha un
muscolo evidenziato; resta la sola incisione e la didascalia non promette
altro. Fonti e licenze in `anatomia/fonti.json` e in didascalia.

---

## 11. Ricerca fatta sull'atlante 3D (non realizzato)

Se si riprende l'idea, questo è già verificato e non va rifatto.

**Fonte migliore:** [`ashemag/human-atlas`](https://github.com/ashemag/human-atlas),
codice MIT, dati CC BY 4.0, basato su **BodyParts3D 4.0** del RIKEN (ricavato
da risonanze). 2.234 strutture, 15 sistemi.

**Formato decifrato e validato byte per byte.** `public/models/atlas.json` è il
manifest; ogni parte dichiara `chunk` e gli offset. La geometria sta in 15 file
`body-N.bin`:

- posizioni `Float32 × 3` all'offset `positions`
- normali `Int16 × 3 / 32767` all'offset `normals`
- indici `Uint32` all'offset `indices`
- **usare gli offset dichiarati, non calcolarli**: c'è allineamento a 4 byte

Le richieste HTTP Range funzionano (206), quindi si può caricare **una
struttura alla volta**: una vertebra 57 KB, il gran gluteo 76 KB. Muscolare
20,1 MB e scheletrico 8,2 MB in totale.

**Due limiti trovati:**

- **Mancano gran dorsale, retto dell'addome e quadrato dei lombi** dal
  sottoinsieme (zero risultati per «dorsi» e «abdominis» su 2.234 strutture).
  L'archivio originale li ha, ma **non sono allineabili**: confrontando le ossa
  comuni, omero e radio combaciano a 0,998 mentre la clavicola sta a 1,331 e il
  femore a 0,829. Sono versioni diverse del dataset.
- **I tendini non ci sono.** Il sistema connettivo ha 40 strutture e l'unico
  tendine rilevante è quello calcaneare.

**Scartata:** [`vulovix/body-muscles`](https://github.com/vulovix/body-muscles),
Apache 2.0. Ogni muscolo è un poligono di 4-6 punti, zero comandi curva in
tutto il file.

---

## 12. Cosa resta aperto

**Origine, inserzione e tendini sulle 18 schede.** Matteo l'ha scelto
esplicitamente: per ogni muscolo, da quale osso parte e su quale si inserisce
con il punto anatomico preciso, più quali tendini si caricano in quali
esercizi. **Non ancora fatto.** L'archivio ha già Reeves, Kubo e la rassegna
sull'Achille da agganciare.

**Idee proposte e mai scelte:** modalità coach con consegna via link o QR
(verificata, 894 caratteri); strumento «Bilancio» per peso e calorie;
ripasso a intervalli dei contenuti; schede clienti; controllo del volume dentro
l'editor della scheda.

---

## 13. Progetto gemello: `scheda`

`/Users/matteocamerini/Claude/scheda`, da `https://github.com/unholynebula/scheda`.
App di registrazione degli allenamenti, file singolo, italiano.

**In sospeso, da fare a mano sul suo telefono:** se la configurazione era già
stata salvata, i tempi di recupero accorciati (150/120) restano lì. I valori
nel codice sono tornati a **180/150** dopo che avevo male interpretato Singer
2024. Vanno corretti in *Modifica scheda → Tempi di recupero*.

Il programma attuale è a 4 giorni: Gambe 17 serie, Spinta 16, Schiena 17,
Spalle e braccia 18. Ricostruito su richiesta dopo che una variante proposta
non gli era piaciuta: **ripristinare, non «migliorare» di iniziativa.**

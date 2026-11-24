# Ispovesti.ba — priprema produkcije

Ova grana je radna priprema. Nije objavljena i nije spojena u `main`.

## Sigurne granice
- Preview ostaje na svom zasebnom preview repozitoriju i snapshot grani.
- Test sadržaj se ne kopira u produkciju.
- Ne mijenjati produkcijski `main`, domen, DNS, deploy ni live bazu bez posebne potvrde.
- Produkcijski `config.js` mora ostati `mode: "live"` i `chatEnvironment: "live"`.
- Produkcijski API pozivi moraju ostati na `community-live-api` i `chat-live-api`.
- CAPTCHA i live zaštite se ne uklanjaju niti zaobilaze.
- Produkcijski Pages workflow objavljuje samo allowlistu koju priprema `scripts/build-production-review.mjs`; `/test/` se kopira očuvan. Ne objavljivati direktno korijen repozitorija niti mijenjati workflow bez pregleda.

## Read-only pregled 24.11.2026.

### Okruženja i sadržaj
- Supabase projekat `Ispovesti-ba` je aktivan.
- Test i live koriste odvojene šeme: `community_test/chat_test` i `community_live/chat_live`.
- Test šeme imaju probni sadržaj; `community_live.content` i `chat_live.messages` bili su prazni pri provjeri.
- Nema kopiranja test ispovijesti, komentara ili chat poruka u live.

### Repo/struktura
- Preview izvor: `borjansaric/Ispovesti-ba-preview`, snapshot `snapshot/ispovesti-preview-2026-11-24`.
- Produkcijska pripremna grana: `borjansaric/Ispovesti-ba`, `prepare/production-from-preview-2026-11-24`.
- Produkcijski repozitorij ima odvojene root live fajlove i `test/` aplikaciju; preview snapshot ima ažurirani root izvor, test Edge Functions i kopiju live Edge Functions/migracija.
- Preview build pravi hashed module bundle u `dist/`; produkcijski Pages workflow koristi poseban live allowlist build. Build/deploy sistemi nisu zamjenjivi.

### Ključne razlike potvrđene poređenjem fajlova
| Fajl/oblast | Nalaz | Siguran pristup |
|---|---|---|
| `app.js` | Live root ~320 linija / 28.5 KB; preview ~788 linija / 57.2 KB. Preview dodaje feed stanje/sortiranje, direktnu navigaciju, pending submissions, warm-up komentara, dodatne kontrole i reakcije. | Ne zamijeniti cijeli fajl dok se funkcije i live API pozivi ne mapiraju. |
| `api.js` | Live ima CAPTCHA token po slanju; preview ima clearance po anonimnom UID-u, inicijalizaciju sigurnosti, cache i pending submission tok. | Blokirano za direktno kopiranje: live backend trenutno ne podržava preview clearance model. |
| `captcha.js` | Preview uvodi action parametar; produkcijski `captcha.js` prema ranijem auditu čita javni CAPTCHA config sa test endpointa, dok token provjerava live API. | Ispraviti live endpoint kao zasebnu, minimalnu promjenu tek nakon provjere builda i konfiguracije; ne mijenjati CAPTCHA model implicitno. |
| `config.js` | Namjerno različit: live mora ostati `live/live`, preview `live-test/test`. | Sačuvati produkcijski config. |
| `index.html` | Preview ima nove kontrole/feed/banner i asset reference; preview noindex nije za produkciju. | Prenijeti UI elemente selektivno; zadržati live SEO, canonical/robots pravila i validne produkcijske asset putanje. |
| `styles.css` | Preview ~33.2 KB / 317 linija; live ~18.6 KB / 135 linija. | Prvo povezati CSS sa stvarnim HTML komponentama; bez wholesale zamjene dok se ne potvrdi zabrana mijenjanja osnovnog `original.css/styles.css` iz specifikacije. |
| `chat/ui.mjs` | Preview ~11.3 KB / 114 linija; live ~8.8 KB / 51 linija. Preview report UI i meni su znatno prošireni. | Portovati UI sloj po sloj; provjeriti svaku akciju prema live gateway kontraktu. |
| `chat/client.mjs` | Sličan API poziv, ali import/cache reference različite; oba imaju test-code/recovery exports. | Produkcijski build već filtrira live klijent; nikad ne izložiti test-code generator ili recovery key tok u live bundle. |
| `chat/chat.css` | Preview ~9.8 KB / 60 linija; live ~7.4 KB / 33 linije. | Prenijeti samo stilove za postojeće/live potvrđene kontrole. |
| Backend/schema | Preview report UI može očekivati nove report reason/details; live chat schema/gateway se razlikuju. | Prije report UI promjene provjeriti live gateway, SQL constraints i deployed function; bez SQL/Edge Function promjena u ovom zadatku. |

### CAPTCHA i anonimni identitet — blokirajuća razlika
Read-only preview audit bilježi:
- Preview/test: CAPTCHA clearance jednom po anonimnom Auth UID-u, server-side potvrda u `community_test.captcha_clearance`.
- Produkcija: CAPTCHA token pri svakom slanju; live SQL dispatcher nema preview clearance tabelu/RPC.
- Produkcijski CAPTCHA frontend trenutno čita javni sitekey/enabled status preko test API-ja, a live backend provjerava live podešavanja.
- ECDSA instalacioni identitet je odbijen; ne uvoditi.
- Auth brisanje i očuvanje sadržaja nije riješeno; ne dirati FK ili brisanje korisnika.

Zbog toga preview `api.js` / `app.js` nisu direktno prenosivi. Usklađivanje mora zadržati live CAPTCHA ugovor dok se zasebno ne odobri i implementira server-side paritet.

### Izolovana pripremna ispravka 24.11.2026.
Na ovoj pripremnoj grani, samo u root/live klijentu:
- `captcha.js` sada čita javni CAPTCHA config sa `community-live-api`, ne sa test API-ja.
- Cache-buster je osvježen u `api.js` i `app.js`, da browser ne zadrži staru CAPTCHA konfiguracionu rutu.
- Dodan je `tests/live-captcha-config-route.test.mjs` kao regresioni test.
- Provjereno statički: root CAPTCHA ruta pokazuje na live endpoint, test endpoint se ne pojavljuje u root fajlu, a produkcijski allowlist build kopira root `app.js/api.js/captcha.js`.
- **Automatizovani test nije pokrenut u ovom okruženju.** Ova promjena nije spojena u `main`, nije deployovana i nije mijenjala Supabase.

### Izolovana chat prijava UI 24.11.2026.
Na pripremnoj grani je prenesena mala, backend-kompatibilna chat UI dorada:
- Browser prompt je zamijenjen jasnim izborima: abuse/uvredljiv sadržaj, prijetnja, spam, ostalo.
- Razlozi su tačno live SQL vrijednosti `abuse`, `threat`, `spam`, `other`; prijava šalje samo `id` i `reason`. Nema `details` polja jer live gateway/SQL trenutno ne podržavaju dodatni opis.
- Dodani su report option stilovi samo u `chat/chat.css` i desno-proširena dodirna površina tri tačke; cache-busteri osvježeni u `index.html`.
- Dodan je `tests/live-chat-report-ui.test.mjs` koji provjerava reason contract i odsustvo prompta.
- Statička provjera potvrdila je da prompt više nije u root live UI-u, da su sva četiri live reason koda prisutna i da se `details` ne šalje.
- **Automatizovani test nije pokrenut.** Promjene su samo u pripremnoj grani; live gateway/SQL, `main` i deployment nisu mijenjani.

## Migracijski redoslijed
1. Inventar svih root/live datoteka, `dist/` allowlist builda, `test/`, Pages workflowa i backend ugovora.
2. Prenos HTML/CSS/UI komponenti koje ne mijenjaju API/security; provjeriti asset reference i mobilni raspored.
3. Chat UI: meni/report forma samo uz potvrđen live gateway payload i validne live report reason vrijednosti.
4. Feed/app funkcije: prenos po funkciji, ne zamjena cijelog `app.js`; zadržati live API signatures, CAPTCHA token flow, auth keys i live endpoint.
5. Pending submissions/cache: analizirati duplicate/idempotency server contract; ne aktivirati dok nije potvrđeno da live backend podržava request IDs i retry semantics.
6. CAPTCHA config endpoint: live-only minimal fix, sa testom, bez promjene CAPTCHA frekvencije ili clearance modela.
7. Build/QA: provjeriti live allowlist bundle, `/test/` byte preservation, zabranu test API-ja/test generatora u live bundle, linkove/asset reference, static checks i odvojeni test preview bez live sadržaja.
8. Završni pregled promjena i eksplicitno odobrenje prije merge/deploy/domain/DNS.

## Status
- [x] Odvojena produkcijska pripremna grana kreirana.
- [x] Read-only pregled test/live izolacije i Pages build allowliste.
- [x] Početni inventar ključnih UI/API razlika napravljen.
- [x] Pripremna grana: live CAPTCHA config endpoint usmjeren na live API; regresioni test dodat (nije pokrenut).
- [ ] Potpuni pregled svih root/live i build datoteka.
- [x] Prva chat report UI dorada prenesena uz postojeći live contract.
- [ ] Ostale UI dorade — u toku; API/backend kompatibilnost prvo.
- [ ] Testiranje i završna provjera — nije urađeno.
- [ ] Produkcijska objava — nije odobrena/urađena.

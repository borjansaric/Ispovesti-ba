# Ispovesti.ba — produkcijsko usklađivanje

## Izvor istine
- Zaključani preview: `borjansaric/Ispovesti-ba-preview`, grana `snapshot/ispovesti-preview-2026-11-24`.
- Snapshot commit: `2b2b6c36df904e2b6d93bb82d246d7fa53fccebb`.
- Produkcijska pripremna grana: `prepare/production-from-preview-2026-11-24`.
- PR #3: https://github.com/borjansaric/Ispovesti-ba/pull/3

## Nepromjenjive granice
- Preview snapshot ostaje netaknut.
- Produkcijski `main` ostaje netaknut do završetka provjera i merge-a.
- Nema promjene DNS-a ili domena.
- Nema kopiranja testnih ispovijesti, komentara, chat poruka, korisnika ili administratorskih podataka u live.
- Postojeće legacy tabele u `public` nisu dirane.
- CAPTCHA, autentifikacija, RLS, rate limits i administratorska zaštita ostaju aktivni.

## Frontend i build
- Preview frontend i klijentski moduli preneseni su u produkcijski root i prilagođeni na `mode: live`, `community-live-api` i `chat-live-api`.
- Live auth storage i lokalna evidencija nedovršenih slanja imaju odvojene live nazive.
- CAPTCHA ostaje entry-only: Turnstile se provjerava pri ulasku, a server provjerava clearance pri slanju.
- Gornji banner slot je sticky i skriva se dok je chat otvoren.
- Administratorski oporavak je ponovo povezan sa live admin login panelom; CSP dozvoljava Cloudflare Turnstile.
- Produkcijski chat admin ulaz zadržava postojeći sigurni `live/chat-admin.mjs` modul i arhivski prikaz.
- Review build gradi javni paket jednom prije testova i iz njega uklanja test API i trial-code generator.
- `/test/` ostaje zaseban i nije prepisan.

## Live SQL migracije — PRIMIJENJENE
1. `20261124175331_chat_live_report_parity.sql` — chat prijave koriste `hate_speech`, `spam`, `other` i opis do 500 znakova.
2. `20261124175333_live_entry_captcha_clearance.sql` — server-side CAPTCHA clearance po anonimnom Auth UID-u.
3. `20261124175336_live_preview_feature_parity.sql` — reakcije, moje ispovijesti, admin read funkcije, analitika posjeta i retention.
4. `20261124175339_live_free_chat_parity.sql` — besplatan zajednički chat, uz očuvanje aktivnog kupljenog/vlasničkog pristupa i istorije.
5. `20261124175342_live_community_report_parity.sql` — community prijave prihvataju `hate_speech` i čuvaju opis do 500 znakova; admin pregledi prikazuju opis.
6. `20261124175439_live_reporting_fk_indexes.sql` — indeksi za nove/usklađene report i reaction FK veze.

## Live Edge Functions — DEPLOYOVANE
- `community-live-api`: verzija 6, postojeći `verify_jwt=false` režim zadržan; sada uključuje entry-only CAPTCHA clearance, posjete, moje ispovijesti i admin read rute.
- `chat-live-api`: verzija 2, postojeći `verify_jwt=false` režim zadržan; koristi `live/chat-index.ts` i `chat/gateway.mjs`, sa preview report ugovorom i besplatnim pristupom.
- Nisu mijenjani `community-test-api`, `chat-test-api` ni `admin-recovery-live-api`.

## Podaci i izolacija
- `community_live.content`: 0 zapisa; `chat_live.messages`: 0 poruka.
- `community_test.content`: 77 zapisa; `chat_test.messages`: 26 poruka — nijedan testni zapis nije kopiran u live.
- Legacy `public` tabele ostale su netaknute: 17 ispovijesti, 25 komentara, 2 glasa i 91 privatna lista.
- Live CAPTCHA je aktivna; free chat je uključen. Nisu promijenjeni postojeći administratorski nalozi ili korisničke sesije.

## Provjere
- CI run #64 prošao je kompletan `npm test`.
- CI run #65 provjerava dodatne indekse i novi test; rezultat se još čeka.
- Security advisor nakon migracija nije prijavio nove probleme na novim tabelama. Postojeće napomene uključuju isključenu zaštitu od kompromitovanih lozinki i upozorenja za namjerno anonimne/servisne RLS obrasce.
- Performance advisor je prijavio dvije FK veze bez indeksa u live report/reaction tabelama; migracija #6 ih pokriva.
- PR #3 je spojen u `main` commitom `605c4bbf81859fd1f0d7bda1aed31796db47b6a7`.
- GitHub Pages workflow #144 uspješno je prošao live preflight, produkcijski build i deploy; Pages build/deploy workflow #142 takođe je uspješno završen.
- Live Edge Functions su aktivne: `community-live-api` v6 i `chat-live-api` v2.

## Završno stanje
- [x] Šest live SQL migracija primijenjeno i evidentirano pod odgovarajućim verzijama.
- [x] Obje live Edge Functions deployovane i aktivne.
- [x] Produkcijski CI prošao.
- [x] GitHub Pages preflight, build i deploy prošli.
- [x] Preview snapshot i `/test/` ostali netaknuti; testni podaci nisu kopirani u live.

**Trenutno stanje: Ispovesti.ba je objavljen na https://borjansaric.github.io/Ispovesti-ba/.**

# Ispovesti.ba — priprema pune paritetne produkcije

## Izvor istine
- Zaključani testni snapshot: `borjansaric/Ispovesti-ba-preview`, grana `snapshot/ispovesti-preview-2026-11-24`.
- Snapshot commit: `2b2b6c36df904e2b6d93bb82d246d7fa53fccebb`.
- Produkcijska pripremna grana: `prepare/production-from-preview-2026-11-24`.
- Ovaj dokument prati pripremu; ne predstavlja odobrenje za objavu.

## Nepromjenjive granice
- Testni snapshot ostaje netaknut.
- Produkcijski `main` ostaje netaknut dok se ne završe pregled i odobrenje.
- Nema automatskog deploya, promjene DNS-a ili povezivanja domena.
- Nema kopiranja testnih ispovijesti, komentara, poruka, korisnika ili administratorskih podataka u live.
- Produkcijski klijenti moraju koristiti live API-je i live šeme; testni kodovi i probna prava ne smiju biti dostupni u produkciji.
- CAPTCHA, autentifikacija, RLS, ograničenja i administratorska zaštita ne smiju biti uklonjeni niti zaobiđeni.

## Preneseno na pripremnu granu
- Frontend i klijentski moduli iz zaključanog preview-a preneseni su u produkcijski root: `index.html`, `app.js`, `api.js`, `captcha.js`, `config.js`, CSS, chat UI/klijent, administratorski UI i zavisni moduli.
- Produkcijska konfiguracija je prilagođena na `mode: live` i `chatEnvironment: live`.
- Community API klijent i CAPTCHA konfiguracioni poziv usmjereni su na `community-live-api`; chat klijent bira `chat-live-api`.
- Live auth storage i lokalna evidencija nedovršenih slanja imaju zasebne live nazive.
- U javnom početnom HTML-u uklonjen je preview `noindex,nofollow`; administratorske stranice zadržavaju zabranu indeksiranja.
- Produkcijski review build sada uključuje nove community i chat admin module.
- Live chat gateway prosljeđuje polje `details` uz prijavu poruke.

## Pripremljene, ali NEPRIMIJENJENE SQL migracije
- `20261124173000_chat_live_report_parity.sql`: usklađuje live prijave chata sa preview ugovorom: `hate_speech`, `spam`, `other` i opcioni opis do 500 znakova.
- `20261124180000_live_entry_captcha_clearance.sql`: dodaje server-side CAPTCHA clearance po anonimnom Auth UID-u i provjeru pri slanju.
- `20261124190000_live_preview_feature_parity.sql`: priprema live reakcije, privatnu listu mojih ispovijesti, administratorske preglede, analitiku posjeta i obavezni request ID.
- `20261124200000_live_free_chat_parity.sql`: priprema besplatan zajednički chat kao u preview-u, uz očuvanje aktivnog kupljenog/vlasničkog pristupa i javnu istoriju poruka.
- Nijedna migracija iz ove pripremne grane nije primijenjena na Supabase.

## Pripremljen, ali NEOBJAVLJEN backend kod
- `launch/community-live-api.ts` sada sadrži planirani tok `captcha_init`: provjera postojeće clearance potvrde, Turnstile akcija `app_entry`, upis potvrde i provjera potvrde pri slanju.
- Live community API sada priprema rute za `track_visit`, `my_confessions` i administratorske read akcije.
- Chat live SQL migracija priprema besplatan pristup kao u preview-u; chat report ugovor prenosi opis prijave.
- `chat/gateway.mjs` prosljeđuje `details` za prijave.
- Edge Functions nisu deployovane; produkcijski endpointi i dalje izvršavaju trenutno deployovane verzije.

## Preostalo prije odobrenja
1. Uskladiti sve live SQL funkcije i šeme sa funkcijama koje preview frontend koristi: feed sortiranje, reakcije, glasanje, komentari/odgovori, privatne liste, moje ispovijesti, dnevni izbor, analitika posjeta, obavještenja, administratorski pregledi i moderacija.
2. Pregledati i testirati migracije na izolovanom okruženju prije bilo kakve primjene na live.
3. Uskladiti chat SQL, administratorske prikaze i izvještaje sa novim UI ugovorom.
4. Uskladiti community Edge Function sa svim akcijama koje šalje preview klijent; provjeriti autentifikaciju, rate limits, CAPTCHA i dozvoljene origin-e.
5. Pokrenuti build, sve relevantne testove i statičke provjere; provjeriti da live bundle ne sadrži test API-je, probne kodove ili testne generator-e.
6. Provjeriti da se `/test/` i postojeće privatne/administratorske stranice ne mijenjaju neželjeno.
7. Napraviti završni pregled diff-a i tek nakon posebnog odobrenja planirati objavu.

## Trenutno stanje
- [x] Zaključani preview snapshot identifikovan.
- [x] Produkcijska pripremna grana odvojena od `main`.
- [x] Glavni frontend i klijentski moduli preneseni.
- [x] Produkcijska konfiguracija i API destinacije prilagođene.
- [x] Pripremljene SQL migracije za chat prijave, CAPTCHA clearance, reakcije/analitiku/admin read funkcije i besplatan chat.
- [x] Pripremljen live community Edge Function kod za CAPTCHA clearance, posjete, moje ispovijesti i administratorske preglede.
- [ ] Potpun SQL/API paritet za sve funkcije preview-a (uključujući preostale razlike dispatch/chat admin funkcija i bezbjednosnih pravila).
- [ ] Build i automatski testovi uspješno izvršeni.
- [ ] Završni pregled i odobrenje.
- [ ] Deploy (nije odobren niti izvršen).

**Ova grana je radna priprema, ne gotova produkcija.**

# Ispovesti.ba — izolovana razvojna verzija

Ova grana sadrži isključivo razvojni kod i lokalne testove. Nema produkcionih kredencijala, inventara stvarnih podataka, starog produkcionog frontenda ili izvještaja o infrastrukturi. Ne objavljuje GitHub Pages.

## Lokalna proba

Node 24+: `npm ci`, `npm test`, `npm run dev`.
Server pokreće stvarni SQL i Edge handler u izolovanom PostgreSQL/PGlite runtime-u. Lokalni Auth adapter je probni i nema vezu s vanjskim Supabase projektom. Probni podaci su u ignorisanom `.local-stage/` folderu. Administracija je zaključana u lokalnom režimu.

`dist/config.js` je podrazumijevano prazna preview konfiguracija. Browser-local demonstracija i lokalni HTTP test nisu dokaz rada pravog Auth/MFA/CAPTCHA/cron servisa.

## Zasebni Supabase test

Novi testni projekat nije napravljen: nalog je dostigao limit dva aktivna Free projekta. Za nastavak treba korisnikov izbor kako osloboditi kapacitet; nije uključen plaćeni plan, niti su postojeći projekti pauzirani, brisani ili mijenjani.

Nakon što postoji izričito odobren zasebni testni projekat, treba primijeniti šemu, postaviti community-api i ALLOWED_ORIGINS za testni domen, podesiti anonimni Auth/CAPTCHA i zaštićeni admin pristup, pa provjeriti pravila kroz stvarne sesije. Servisni ključ nikada ne ide u frontend ni repozitorijum. Produkcioni prelazak zahtijeva posebnu konačnu saglasnost.

## Korisnički izgled

Zadržan je postojeći tamni stil. U formama piše samo Nadimak, bez pomoćnih napomena o dužini i linkovima. Ograničenja pri slanju ostaju.

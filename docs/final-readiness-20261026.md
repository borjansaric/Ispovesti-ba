# Završna provjera Ispovesti.ba — 26.10.2026.

Status: /test/ provjeren; prelazak glavnog sajta još nije spreman za odobrenje.

## Obim i očuvanje

Ova provjera nije izvršavala SQL migracije, upise u bazu, arhiviranje, Edge deployment ili objavljivanje sajta. Jedina popravka je lokalni regresioni test. GitHub main commit: 31bd32baf090b9abeb93621efbffeb6fab9b825e. Glavni index.html ostaje blob 9f83f627a4917953a70b4efe9c01a05a5c130372. Objavljeni test/app.js, test/index.html, test/chat/chat.css i test/chat/thread-model.mjs identični su provjerenom lokalnom paketu. Chat UI i aktivne Edge verzije nisu mijenjani.

## Rezultati

- npm test: 121/121 prolazi, 0 grešaka. Prvi prolaz 120/121 otkrio je zastarjelu provjeru broja RPC poziva. Novi gateway smije čitati roditeljski komentar prije CAPTCHA, ali ne smije poslati submit u SQL. Test sada eksplicitno provjerava zabranu tog upisa; sigurnosna zaštita nije mijenjana.
- To su lokalni PGlite/gateway/client testovi; dio starijih klijentskih testova koristi dist. Nisu zamjena za ponovnu stvarnu administratorsku prijavu pri produkcionom prelasku.
- Supabase ACTIVE_HEALTHY; 9 postojećih migracija. Nijedna nije ponavljana.
- community_test i chat_test postoje. community_live/chat_live ne postoje; community-live-api nije postavljen.
- CAPTCHA u testnom okruženju uključena. Jedan testni administrator sačuvan.
- Sve postojeće aplikacijske tabele imaju RLS. Testni community/chat dispatch RPC-ovi nedostupni su anon/authenticated; dostupni su service_role serveru.
- Primarni ključ glasova (content_id,user_id) i enforce_one_vote_change trigger postoje.
- 28 ranijih privatnih snapshot tabela i kopija glasova postoje, imaju RLS i nisu čitljivi anon/authenticated ulogama. Raniji privatni ZIP takođe postoji.
- Nisu pronađene stvarne service_role JWT ili sb_secret_ vrijednosti u javnom testnom paketu. Pojava teksta sb_secret_ u Supabase biblioteci je samo prepoznavanje prefiksa ključa.
- Ranija provjera stvarnog /test/ učitavanja odgovora: prvi odgovor 599 ms, svih pet 2322 ms; prikaz je progresivan, inline uz zamagljivanje okoline. To je jedno mjerenje, ne garancija svake veze.

## Prepreke glavnom objavljivanju

1. launch/prepare-live.sql i launch/community-live-api.ts su starija priprema. Nemaju aktuelno ograničenje jedne promjene glasa (change_used/can_change), a provjera roditelja odgovora u toj pripremi ne ograničava roditelja isključivo na glavni komentar. Ne primijeniti postojeće skripte kao konačne.
2. Potrebno pripremiti usklađen glavni API/SQL i pregled cijelog SQL-a; primjena tek poslije posebnog odobrenja vlasnika. Novi prazni glavni sadržaj mora ostati odvojen od /test/.
3. Stare public.confessions/comments su još javno čitljive SELECT politikom true. Trenutni sadržaj 17 ispovijesti i 24 komentara ne smatra se privatnom arhivom. Postojeći plan archive-legacy-after-cutover.sql čuva redove i zatvara pristup, ali nije primijenjen i ne smije se izvršiti dok stari glavni sajt radi.
4. Kopije nisu potpuno ažurne: testni sadržaj 21 prema 20 u snapshotu; privatne liste 23 prema 12; chat poruke 10 prema 6. Prije prelaska napraviti novu privatnu kopiju i provjeru vraćanja bez prepisivanja starih kopija. Ova provjera nije pravila novu kopiju niti izvozila privatne podatke.
5. Produkcijski chat nije odvojen/pripremljen: klijent namjerno prihvata samo chatEnvironment=test. Ne povezivati glavni sajt s testnim paketima i probnim kodovima. Stvarni SMS provajder, cijene i naplata nisu uključeni.
6. release-manifest.json i dio launch dokumentacije su zastarjeli i moraju biti obnovljeni prema posljednjoj specifikaciji. Istorijske bilješke o 3/2/1 nisu aktuelne: osnovni sajt je besplatan.
7. Jedan nenametljivi baner predviđen je kao sticky, bez prekrivanja sadržaja; stvarna mreža nije aktivirana.

## Postojeće sigurnosne napomene

Supabase advisor: javni EXECUTE na rls_auto_enable (event_trigger, nije obična RPC funkcija); cron politike imaju široke uloge, ali anon nema USAGE nad cron šemom; zaštita od kompromitovanih lozinki nije uključena. Informativni nalazi o RLS bez politika za privatne testne/back-up tabele odgovaraju serverskom pristupu uz zabranjen direktni klijentski pristup. Nisu automatski mijenjane dozvole.

Zvanična objašnjenja: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable i https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Sljedeći bezbjedan korak

Pripremiti usklađen produkcijski paket, nove testove prenesenih pravila, ažurnu specifikaciju i potpuni SQL za pregled. Zatim odvojeno odobriti migracije, nedestruktivno zatvaranje starog javnog API-ja i konačno glavno objavljivanje. Trenutno nema odobrenja za te radnje.

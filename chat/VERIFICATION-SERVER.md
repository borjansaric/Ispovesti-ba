# Objavljeni /test/ — 25.10.2026.

Test URL: https://borjansaric.github.io/Ispovesti-ba/test/
Administracija: /test/admin.html → Administracija anonimnog chata.
Objavljeni commit: 5ff4f2f470d9a54b9707bf8e1e333897c9864dc4.

Primijenjena migracija je 20261025155252, isolated_chat_test_packages_profiles_and_moderation. Nije ponavljana. Odobreni chat/prepare-test.sql ima SHA-256 2ddd8682699d47be2ae0134fb499bdbaf83ac912dd1ba7a96806e18af6f23d62. Serversko podešavanje CHAT_TEST_GRANTS_ENABLED=true je sačuvano; testni režim dodatno je uključen kroz stvarnu administratorsku sesiju. Naplata je isključena.

## Potvrđeno

- 101 lokalni test prolazi, 0 grešaka. Provjere isteka, rezervacije nadimka i povrata naloga koriste lokalnu bazu i simulirano proteklo vrijeme; produkcijski sat nije mijenjan.
- Stvarni Supabase Auth izdaje tri odvojena anonimna tokena. Profil koristi potvrđenog vlasnika tokena; krivotvoreni p_uid, session_id i AAL u tijelu zahtjeva ne daju ovlasti.
- Svih 11 administratorskih radnji odbijeno je anonimnom korisniku; nedostajući i izmijenjeni JWT vraćaju 401, neposredni servisni RPC je zabranjen klijentu.
- Administratorska lozinka i jednokratni e-mail kod uspješno otvaraju postojeći panel. Ista potvrđena sesija otvara chat administraciju i dodjeljuje probne pakete.
- Paketi 24h, 7d i 30d stvarno su dodijeljeni kroz administratorski interfejs. Autentifikovani API potvrđuje aktivna prava i pomičnu istoriju 1h, 7h i 31h; browser-supplied history_hours i server_now ne proširuju prozor.
- Slanje iz stvarnog API-ja i objavljenog interfejsa vidljivo je drugom anonimnom nalogu. Ponavljanje istog request_id ne objavljuje duplikat.
- Prijava poruke stiže moderatoru; blokiranje i odblokiranje filtriraju poruke na serveru.
- Uklanjanje i vraćanje probne poruke kroz administratora potvrđeni su odgovorima API-ja drugog korisnika. Nijedna poruka nije nepovratno obrisana.
- Probna dodjela nadimka i avatara izvršena je odvojeno. Rezervacija nadimka iznosi rok paketa plus 15 dana. Ostali profili ostaju neizmijenjeni.
- Paket preglednika je provjeren protiv privatnih ključeva, servisnog JWT-a i serverskih/SQL datoteka. U njega se ne kopiraju server env tajne.
- Sve izmjene objave nalaze se unutar test/. Svi ostali Git blobovi i workflow su jednaki prethodnoj verziji. HTTP sadržaj glavne stranice ima neizmijenjen blob SHA-1 9f83f627a4917953a70b4efe9c01a05a5c130372. Oba Pages postupka završena su uspješno.
- Postojeći sadržaj, administratorske dozvole, ranije kopije i Git istorija nisu mijenjani. Postojeći podaci mogu rasti redovnim korištenjem sajta. Dodani su samo anonimni testni nalozi i podaci novog chat_test sistema.

## Kako isprobati

1. Na /test/ otvori meni → Anonimni chat → Otvori moj chat nalog.
2. Zapamti prikazani chat ID ili nadimak; ostani u istom pregledniku.
3. Na /test/admin.html prijavi se postojećom lozinkom i e-mail kodom, zatim otvori Administraciju anonimnog chata.
4. Učitaj anonimne naloge, izaberi svoj ID, paket i Dodijeli probni paket. Nadimak i avatar dodjeljuju se zasebno.
5. Vrati se u chat i izaberi Provjeri paket i profil. Drugi preglednik dobija drugi anonimni nalog i zahtijeva zaseban probni paket.

## Preostalo prije glavnog sajta i naplate

Vlasnikov pregled i novo izričito odobrenje za glavnu stranicu; cijene i odabrani pružalac naplate; pravila čuvanja poruka i uzrasta; produkcijska zaštita masovnog kreiranja anonimnih naloga. Nema aktivnih naplatnih ruta, ugovora ili automatskog obnavljanja. Stvarne isteke dugih paketa ne tvrdimo da smo vremenski odčekali: provjereni su lokalnim vremenskim testovima.

Postojeći izgled i /test/ statičke datoteke prije objave sačuvani su u Git istoriji prethodnog commita f1b51ed56a1e95f28adfddf13451d528aad46a0c. Povrat se radi ograničeno na test/ i isključivanjem testnog API-ja/flagova, bez brisanja baza ili ranijih kopija.

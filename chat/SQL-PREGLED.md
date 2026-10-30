# Kompletan SQL za vlasnikov pregled — nije izvršen

## Sada predloženo za probni chat

[prepare-test.sql](prepare-test.sql) je cijela skripta, bez skraćenih dijelova. Pravi novu chat_test šemu, profile, pakete, rezervacije nadimaka, poruke, blokade, prijave, zabrane, hash oporavka, dnevnik i idempotentne potvrde. Postavlja RLS i zabranjuje anon/authenticated direktni pristup; pozivi idu kroz gateway i servisni RPC koji utvrđuje stvarnog korisnika. Administratorske radnje koriste postojeću provjeru lozinke/e-mail sesije.

Ne mijenja postojeće community_test ili public tabele, njihove podatke, administratorsku lozinku ni postojeće funkcije. Odbija primjenu ako chat_test već postoji. Probne dodjele počinju isključene. Nema stvarnog SMS plaćanja niti produkcijske chat šeme.

Primjena čeka izričito odobrenje vlasnika upravo ovog fajla. Ne primjenjivati ostale skripte s njim.

## Kasniji zasebni koraci

[../launch/prepare-live.sql](../launch/prepare-live.sql) je cijela ranije pripremljena osnova prazne community_live šeme. Nije ponovo izvršavana niti mijenjana za chat. Sada odgovara besplatnom osnovnom modelu jer nema reklamnih prava, ali objavljivanje na glavnom sajtu i dalje čeka novi pregled i izričito odobrenje.

[../launch/archive-legacy-after-cutover.sql](../launch/archive-legacy-after-cutover.sql) je cijeli novi plan nedestruktivne arhive. Oduzima starim javnim ulogama i starim servisnim endpointima pristup samo starim legacy tabelama. Ništa ne briše. Postojeći /test/ koristi drugu šemu i zadržava dozvole. Mora biti odobren posebno i izvršen tek nakon prelaska glavnog sajta, jer bi ranija primjena prekinula stari sajt. Lokalni test potvrđuje čuvanje redova i odbijen pristup svim starim klijentskim ulogama.

[../launch/activate-publisher.sql](../launch/activate-publisher.sql) je raniji odvojeni raspored za glavni sajt. Nije potreban za chat /test/ i ne smije se primijeniti kao dio probnog chata.

SHA-256 svih pripremljenih SQL fajlova nalazi se u release-manifest.json. Nema skripte za brisanje podataka u ovom novom planu.

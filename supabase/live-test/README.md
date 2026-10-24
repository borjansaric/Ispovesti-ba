# Odobrena proba na postojećem projektu

Korisnik je odobrio testiranje na pravom sajtu, uz mogućnost vraćanja. Izabrana je posebna putanja /test/ i zasebna šema community_test u postojećem projektu. Stari frontend i tabele ostaju zasebni.

## Izvršeno

- Primijenjena je nova testna šema i zatvoren direktni pristup anon/authenticated ulogama.
- Postavljen je zaseban community-test-api. Auth provjerava server; klijentski identifikatori se ne koriste kao potvrda identiteta.
- Dodate su četiri izmišljene ogledne ispovijesti, komentar i odgovor. Ovi početni primjeri nemaju autora; svako korisničko slanje kroz gateway zahtijeva stvarni potvrđeni Auth identitet.
- Uključen je isključivo cron community-test-publish-hourly: provjera jednom u minuti, objavljivanje najviše jedne ispovijesti na sat. Stari sistem nije zamijenjen.
- Kreirana je backup/pre-live-test-20261024 na prethodnom stanju glavne grane.
- Pripremljena je work/live-test-20261024 sa novim statičkim test/ fajlovima i provjerom kroz stvarni Auth/API. Početna stranica i postojeći Pages workflow nisu mijenjani u toj pripremi.
- Svih 36 lokalnih provjera i GitHub Actions Verify isolated live test API su prošli. Provjereni su stvarni anonimni nalozi, odbijanje lažnog tokena, red, duplikati, komentari/odgovori, privatne liste između dva korisnika, glasovi i skrivanje rezultata, prijave, odbijanje anonimnog administratora i zatvoren direktni RPC.
- Zaključavanje nakon roka provjereno je i na stvarnoj bazi promjenom vremena samo probnog glasa unutar transakcije koja je završena ROLLBACK-om.

## Još nije potvrđeno

GitHub update main za objavljivanje /test/ automatski je odbijen zbog zahtjeva za konačno odobrenje. Ne navoditi da test/ radi na Pages dok deployment nije potvrđen. Stvarni administratorski nalog sa TOTP i CAPTCHA zaštita još nisu podešeni. Nisu dokazane desetominutna promjena vremena u stvarnom pregledniku i konačna mobilna vizuelna provjera ove povezane verzije.

## Povratak bez gubitka podataka

Ako proba treba biti zaustavljena: postaviti community_test.publisher.paused=true i zamijeniti samo community-test-api odgovorom 410. Ne brisati stare podatke, Auth korisnike, testnu šemu niti ekstenzije. Za povratak Pages sadržaja napraviti novi commit s prethodnim stablom iz backup/pre-live-test-20261024, bez prepisivanja istorije. Svako konačno čišćenje podataka ostaje zasebna odluka korisnika.

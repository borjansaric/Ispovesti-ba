# Ispovesti.ba — priprema zvanične verzije

Status 25.10.2026: **BESPLATNI OSNOVNI SAJT I PROBNI CHAT PRIPREMLJENI LOKALNO. SQL I OBJAVLJIVANJE ČEKAJU ODOBRENJE.**

Nova odluka iz PROJECT_RULES.md ukida obavezne reklame 3/2/1. Kontrola objavljivanja zahtijeva posting_policy:free i postojeću administratorsku zaštitu; ne zahtijeva reklamna prava. Pripremljeni glavni API vraća tu politiku, a slanje sadržaja ostaje iza postojeće CAPTCHA i serverskih pravila. Plaćeni paketi odnose se samo na chat. Vidi chat/README.md za probni rad i chat/PREMIUM-SMS.md za šest tržišta.

Prvo se odobrava i provjerava chat/prepare-test.sql na testnom endpointu. Stari glavni plan ispod ne izvršavati automatski. launch/archive-legacy-after-cutover.sql je zasebna nedestruktivna zabrana starih API puteva i smije se primijeniti samo uz posebno odobrenje nakon prelaska glavnog sajta.
Zvanična stranica koristi isti provjereni izgled i funkcije kao `/test/`, a dobija zasebnu bazu sadržaja unutar postojećeg Supabase projekta. Počinje prazna. `/test/` ostaje dostupan sa svojim probnim podacima; njegove buduće objave, glasovi, privatne liste i moderacija ne mijenjaju zvanične podatke.

Administrator koristi postojeći e-mail i lozinku, zatim novi jednokratni kod sa e-maila. Novi nalog, aktivacioni kod i Authenticator nisu potrebni. Cloudflare podešavanja preuzimaju se na serveru; tajni ključ nije u kodu i ne treba ga ponovo slati.

Ova priprema ne kupuje niti povezuje novu domenu. Po odobrenju mijenja se sadržaj na postojećoj adresi `https://borjansaric.github.io/Ispovesti-ba/`. Prikazani naziv ostaje Ispovesti.ba. Za vlastitu domenu posebno se podešavaju DNS, dozvoljeni hostname i Cloudflare widget.

## Šta je pripremljeno

- Korijenski HTML/JS/CSS i zaštićena administratorska stranica, sa sačuvanim dizajnom.
- `launch/prepare-live.sql`: atomski stvara praznu `community_live` šemu i zasebne servisne RPC funkcije. Postojeće tabele i sadržaj ne prepravlja. Kopira samo identitet jednog administratora i podešavanja zaštite, unutar servera. Ne kopira objave, glasove, liste, potvrde prijave ili Auth lozinke. Objavljivanje je u početku pauzirano.
- `launch/community-live-api.ts`: zaseban Edge Function `community-live-api`. Provjerava Auth na serveru, e-mail dokaz, CAPTCHA, hostname, action i jednokratnost tokena. Novi administratorski nalozi se ne aktiviraju kroz taj endpoint.
- `launch/activate-publisher.sql`: poseban raspored najviše jedne ispovijesti na sat, najstarije prvo.
- `scripts/check-live-ready.mjs`: zaustavlja GitHub Pages objavljivanje ako zvanični backend nije spreman ili administratorski zahtjev bez prijave nije odbijen.
- Testovi potvrđuju praznu početnu bazu, odvojenost okruženja, postojeći administratorski nalog, zasebnu e-mail potvrdu i zabranu direktnog pristupa tabelama.

## Redoslijed nakon izričitog odobrenja vlasnika

Ovo izvršava pomoćnica. Vlasnik ne treba pisati SQL niti unositi tajne ključeve u GitHub.

1. Ponovo provjeriti glavnu granu, dostupnost svježe privatne kopije baze i kopije koda. Ako se predloženi kod razlikuje od pregledanog, pripremiti ažuriran pregled prije primjene.
2. Primijeniti tačno pregledani `prepare-live.sql` kroz Supabase migraciju, uz odobrenje za `production-launch-v1`. Bez potvrde skripta sama prekida postupak. Ponovna primjena na postojeću zvaničnu šemu takođe se odbija.
3. Postaviti samo novi Edge Function `community-live-api`, sa `verify_jwt:false` jer funkcija sama provjerava svaki zaštićeni JWT kroz Auth. Postojeći `community-test-api` i stari endpointi ostaju nepromijenjeni.
4. Pokrenuti `node scripts/check-live-ready.mjs --initial`; provjeriti da je zvanični feed prazan, CAPTCHA uključena, red prazan i administrator sačuvan. Ne slati javne probne objave u zvanično okruženje. Ako provjera ne prođe, ostaviti glavni sajt na staroj verziji.
5. Aktivirati zaseban raspoređivač tek u odobrenom prelasku. SQL odobrenje je zaštita od slučajnog pokretanja, nije lozinka i ne zamjenjuje saglasnost vlasnika.
6. Prenijeti pregledanu verziju na `main` uz provjeru očekivanog prethodnog commita. Ne koristiti prisilno prepisivanje tuđih novijih izmjena. Pages postupak dodatno provjerava backend prije objavljivanja.
7. Provjeriti objavljenu glavnu stranicu, prazan feed i nedostupnost administratorskih radnji bez prijave. Provjeriti da `/test/` i dalje koristi testni endpoint.
8. Poslati vlasniku provjeren link glavne administracije. Vlasnik prvi put ulazi istom lozinkom i kodom na e-mail, kroz novu potvrdu za zvanični panel.

## Probni podaci i rezervne kopije

**Ovaj prelazak ne briše probne podatke.** Zvanični sajt je prazan zato što koristi novu praznu šemu. Postojeći probni podaci ostaju u starim i testnim tabelama dok vlasnik posebno ne potvrdi njihovo brisanje.

Privatna kopija aplikacijskih podataka, opis šeme, provjereno vraćanje i zaštićen plan budućeg čišćenja sačuvani su odvojeno. Nisu u javnom repozitorijumu. Kopija koda prije prelaska je `backup/before-launch-review-20261024`, commit `f1b51ed56a1e95f28adfddf13451d528aad46a0c`.

Ako vlasnik želi i brisanje prije pokretanja, prvo osvježiti kopiju i spisak podataka, pa tražiti posebno odobrenje tog tačnog spiska. Ne spajati brisanje sa ovim odobrenjem prećutno. Sve tabele, Auth nalozi, administrator, podešavanja i zaštita ostaju sačuvani.

## Povratak i granice provjere

Ako početna priprema ne uspije, transakcija se poništava, a stara glavna stranica ostaje aktivna. Ako objavljivanje ne prođe provjeru backenda, Pages ne objavljuje novu verziju. Za povratak interfejsa koristi se sačuvana verzija koda; eventualne nove zvanične objave čuvaju se u `community_live` i ne brišu se zbog povratka interfejsa.

72 lokalna testa prolazi, uključujući postojeće regresione i nove testove odvojenosti. To su lokalni PostgreSQL/gateway testovi sa zamjenama vanjskih servisa. Nova zvanična šema i Edge Function nisu primijenjeni na stvarnom serveru, a prijava na budući zvanični panel nije izvršena. Te provjere slijede u odobrenom prelasku. Stvarna CAPTCHA i e-mail prijava već rade na `/test/`.

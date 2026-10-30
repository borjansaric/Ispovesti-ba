# Objedinjeni izvještaj — završna priprema 26.10.2026.

**Status: pripremljeno za pregled; nije odobreno za glavno objavljivanje.** Release12 je lokalna priprema na razvojnoj grani. Posljednji javni /test/ ostaje progressive11: https://borjansaric.github.io/Ispovesti-ba/test/?v=progressive11 . Novi sticky baner, pravni nacrti i dijagnostika još nisu javno postavljeni.

## Šta je završeno

- Usklađena konačna specifikacija svih odluka u CURRENT-SPEC-20261026.md. Sačuvani postojeći stilovi original.css/styles.css, Anonimus, fontovi, radnje, inline grane i testni chat. Nema obaveznih reklamnih prava 3/2/1.
- Pripremljeni community_live SQL i community-live-api: odvojen prazan glavni sadržaj, jedan glas po korisniku/sadržaju, najviše jedna promjena u prvih 10 minuta, ista odložena vidljivost rezultata; odgovori samo na glavne komentare; 1.000 Unicode znakova za komentare/odgovore, emodžiji dozvoljeni, linkovi zabranjeni.
- Privatne liste i srca imaju serverski provjerenog vlasnika. Glavna srca komentara i broj odgovora više ne zavise od chat_test. Pripremljeni javni paket ne koristi testne chat kodove ni testne sesije.
- Pripremljeno jedno neutralno sticky mjesto za reklamu u toku stranice. CSS predviđa prostor, scroll-margin i skrivanje u chatu; nema mrežnih reklamnih zahtjeva. Konačna vizuelna provjera je otvorena, nije označena kao uspješna.
- Pripremljeni naslov/opis, favicon, Open Graph slika, canonical/robots/sitemap kroz allowlist builder. SITE_ORIGIN je sada postojeći GitHub Pages URL; vlasništvo nad Ispovesti.ba nije potvrđeno niti je DNS mijenjan.
- Pripremljeni jasno označeni nacrti privatnosti, uslova i kolačića, bez tvrdnje o apsolutnoj anonimnosti ili end-to-end šifrovanju. Pravna revizija i podaci operatera/rokovi čuvanja nedostaju.
- Dijagnostika pamti samo do 30 fiksnih šifri grešaka, minut i oznaku verzije, u memoriji preglednika. Ne šalje sadržaj, identifikatore, URL, stack ili podatke na server. To nije udaljeni monitoring niti upozoravanje administratora.
- Pripremljen allowlist produkcijski build: bez SQL-a, server koda, zavisnosti, privatnih kopija i testnog chat entrypointa na glavnoj adresi; /test/ se kopira odvojeno i ne prepravlja u live klijent.
- Pripremljen nedestruktivni plan arhive: stari redovi ostaju u postojećim tabelama, ukidaju se dozvole nad šest legacy tabela tek uz zasebno odobrenje nakon novog HTTP/admin pregleda. Skripta nije izvršena.

## Provjere i dokazi

| Provjera | Rezultat i granica |
|---|---|
| Cijeli lokalni testni skup | 127/127 prolazi, 0 grešaka; Node/PGlite/gateway/client testovi, dio vanjskih servisa je simuliran |
| Završne ciljane provjere servera/izdavanja | 18/18 prolazi; poslije poboljšanja samostalne izgradnje još 4/4 release12 testa prolazi |
| Supabase read-only stanje | ACTIVE_HEALTHY; devet migracija; nijedna ponovljena; community_live/chat_live još ne postoje |
| Aplikacijska kopija | 2026-10-26T22:56:24.343113Z; 32 tabele, 251 red, uključene naknadne privatne liste i testni chat; privatno sačuvana, starije kopije ostaju |
| Vraćanje kopije | Svih 32/251 vraćeno u odvojene tipizirane lokalne tabele, digesti redova identični; nije puna proba Auth, ACL, infrastrukture ili PITR-a |
| Serverski identitet/dozvole | Lokalne provjere stvarne granice: gateway koristi Supabase Auth provjeru, ne browser p_uid/_session_id/_aal; anon/authenticated nemaju direktni testni RPC pristup; live SQL ima izolaciju/serverske dozvole |
| Privatnost liste i metapodataka | Lokalno provjereno da drugi UID ne dobija tuđa privatna srca/liste; live metapodaci odvojeni od chat_test |
| UI/performanse | Ranije javni progressive11: prvi odgovor oko 599 ms, svih pet oko 2322 ms; jedno mjerenje, nije obećanje svake veze. Test sporih/preuređenih serija potvrđuje progresivni prikaz bez duplikata |
| Novi release12 mobilni/desktop prikaz | Nije dovršen: browser nije mogao dosegnuti lokalni preview, a javno testno postavljanje blokirano. Ne tvrditi da su novi baner i prelom provjereni stvarnim preglednikom |
| Tajni ključevi | U pregledanom javnom paketu nema stvarnih service_role JWT/sb_secret vrijednosti; prepoznavanje prefiksa unutar Supabase biblioteke nije ključ |
| Glavni sajt | Main ostaje 31bd32baf090b9abeb93621efbffeb6fab9b825e; root index blob 9f83f627a4917953a70b4efe9c01a05a5c130372; bez produkcijskog deploya ili promjene podataka |

Novi community-live-api nije postavljen, zato stvarna prijava JWT/CAPTCHA/email i funkcionalni upisi na tom budućem endpointu tek slijede poslije posebnog odobrenja. Lokalni testovi nisu takva potvrda. Postojeći administratorski pristup, testni chat i devet migracija nisu mijenjani.

## Šta nedostaje i zahtijeva odluku

1. **Probni deployment release12 i vizuelna provjera.** Automatska provjera odobrenja odbila je ažuriranje main ref-a za devet /test/ fajlova zato što postojeći Pages postupak objavljuje zajednički sajt. Odbijanje nije zaobiđeno; glavni ref nije pomjeren. Potreban je konkretno odobren način zajedničkog testnog deploya uz nepromijenjene glavne datoteke ili odvojeno probno okruženje. Ne ponavljati odbijenu radnju bez rješenja te granice.
2. **Potpuna mogućnost oporavka.** Svježa kopija je aplikacijska; Auth nalozi, provajderske tajne/sesije i puna infrastruktura nisu izvezeni. Prije glavnog prelaska potvrditi dostupnost potpune kopije i vraćanja u postojećem Supabase planu, bez samostalne kupovine.
3. **SQL i server.** Vlasnik pregleda tri potpune skripte u ../launch/SQL-REVIEW-20261026.md i manifest. Zasebno odobrava prepare-live.sql, API deployment, activate-publisher.sql, frontend i kasnije archive-legacy-after-cutover.sql. Nema destruktivnog čišćenja.
4. **Pravna spremnost i domena.** Završiti operator/kontakt, uzrast, pravni osnov/rokove i postupke zaštite podataka; pravna revizija nacrta. Potvrditi vlasništvo/DNS/HTTPS/Turnstile/Supabase origins prije povezivanja domene.
5. **Produkcijski chat kasnije.** Zasebna chat_live arhitektura i plan postoje, izvršni produkcijski chat SQL nije pripremljen/odobren. Premium SMS provider, cijene, callback, ugovori, tržišna/pravna revizija nisu povezani. Glavni chat ostaje jasno nedostupan, bez stvarne naplate. Postojeći testni chat ostaje za probu.
6. **Kasnije, odvojeno:** pojedinačni nadimak uz dodatnu dobrovoljnu reklamu po sadržaju; samo nakon mrežne potvrde i odluke vlasnika. Ne vraća stari 3/2/1. Udaljeno praćenje grešaka i dijeljenje pojedinačne ispovijesti sa njenim server-renderovanim metapodacima ostaju dodatni rad.

Postojeći advisor nalazi su zabilježeni, nisu automatski mijenjani: public execute rls_auto_enable je event_trigger, cron anon nema USAGE, zaštita od kompromitovanih lozinki nije uključena. INFO RLS bez politika odgovara privatnim serverskim/back-up tabelama. Posebno procijeniti prije glavnog prelaska, bez širenja dozvola ili uklanjanja zaštita.

## Bezbjedan redoslijed

Pregled paketa → odobren testni deploy i mobilni/desktop pregled → potvrda svježe i potpune mogućnosti vraćanja → posebno odobren SQL setup → posebno odobren novi API → stvarni JWT/admin/CAPTCHA i spremnost praznog live feeda → odobren publisher/glavni frontend → provjera glavne adrese → tek onda odobrena privatna legacy arhiva i provjera starih REST/Edge puteva. Domena i produkcijski chat imaju odvojene korake. Detalji i postupak bez destruktivnih popravki: SAFE-CUTOVER-20261026.md.

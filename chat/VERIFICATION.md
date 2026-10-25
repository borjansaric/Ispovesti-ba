# Završna provjera pripreme — 25.10.2026.

Status: funkcionalna lokalna probna verzija; nova /test/ i produkcija nisu objavljene. Nijedna SQL migracija nije primijenjena na Supabase.

## Sačuvano

- Ponovo provjeren projekat roxajqagksffbsbzdrap: ACTIVE_HEALTHY; pet ranijih migracija i community-test-api v4. community_live i community-live-api još ne postoje.
- Nova privatna aplikacijska kopija sadrži 17 tabela i 136 redova, uključujući naknadne privatne liste i administratorske e-mail potvrde. Vraćanje svih vrijednosti i ograničenja provjereno u privremenoj lokalnoj bazi. To nije puna Auth/PITR kopija; postojeći Auth nalog, server tajne i projekat moraju ostati.
- Ranije kopije nisu zamijenjene. Nova dodatna kopija ima naziv Ispovesti-ba-rezervna-kopija-20261025.zip i nije u javnom repozitorijumu.
- Sačuvana grana backup/before-free-chat-20261025 na 40c0621b4ef989223e040e946471037325ad1a45. main ostaje na f1b51ed56a1e95f28adfddf13451d528aad46a0c.
- dist/ je identičan prethodnoj sačuvanoj pripremi. original.css i styles.css su identični staroj verziji. Postojeći /test/, Auth i sadržaj nisu mijenjani.

## Automatske provjere

95 testova prolazi, 0 pada. Sadrže ranije regresione provjere baze, reda, glasanja, privatnih lista, CAPTCHA, administracije i idempotentnog slanja, uz novu besplatnu politiku.

Nove provjere obuhvataju:

- tri trajanja i tačne pomične istorije 1/7/31 sat, ignorisanje klijentski izmišljenog prozora i istek čitanja/slanja;
- automatski anonimni profil bez javnog Auth ID-ja; nema privatnih poruka;
- zabranu samostalnog probnog paketa ili kupovine, uključivanje testova samo administratoru i dvostruku serversku zaštitu od probnih grantova u produkciji;
- odvojene nadimke i avatare, 15 dana rezervacije, obnovu bez ponovne kupovine nadimka i preuzimanje nakon isteka rezervacije;
- trajno sačuvan kupljeni avatar, oporavak u novu anonimnu sesiju, rotaciju ključa i odbijanje starog ključa/sesije;
- RLS i odsustvo direktnog klijentskog pristupa tabelama/RPC funkciji, provjerenu e-mail sesiju administratora i ignorisanje podmetnutog user/session ID-ja;
- dva stvarna lokalna HTTP klijenta koja vide zajedničku sobu;
- idempotentne poruke i dodjele, spam, linkove, dužinu, prijave, lične blokade, moderatorsko uklanjanje/vraćanje i zabranu naloga;
- privatnost lokalnog administratorskog ključa i zabranu serviranja SQL-a, serverskog izvora i privatnih datoteka;
- besplatno slanje osnovnog sadržaja bez reklamnih tokena i odsustvo aktivnog reklamnog SDK-a;
- plan arhive koji odbija primjenu bez odobrenja/live šeme, zadržava svaki probni red i odbija stare anon/authenticated/service_role puteve, dok testna šema i dalje radi.

## Vizuelna provjera

Lokalni pregled otvoren kroz upravljani preglednik. Provjeren ulaz kroz postojeći meni, prozor chata, automatski profil i odbijen pristup bez paketa. Mobilni okvir 390×844: širina sadržaja i scrollWidth su 375px, prozor 347px; nema horizontalnog prelivanja. Pregledane su crno-zlatne komponente, paketi i pravila. Stvarne dvije sesije i probna administracija provjerene su HTTP testovima; puna ručna dvokorisnička mobilna konverzacija nije izvršena.

## Granice

Lokalni test koristi PostgreSQL-compatible PGlite, Auth zamjenu i zaseban privatni administratorski ključ. Nema stvarne naplate, Turnstile poziva ili slanja e-maila iz tog pregleda. Prava Supabase e-mail prijava, CAPTCHA i chat zajedno čekaju odobrenu primjenu nove šeme i testni endpoint. Lokalni pregled je privremen i nije javna adresa /test/.

SMS istraživanje je preliminarno, s izvorima u PREMIUM-SMS.md. NTH Mobile je kandidat za svih šest tržišta; stvarna podrška po operateru, provizije i isplate zahtijevaju ponudu. Nema potvrđenog ugovora, cijena ni spremne stvarne SMS integracije. Niko nije kontaktiran.

Komercijalno ponašanje pri kupovini drugog paketa prije isteka, rok čuvanja poruka i uslovi uzrasta još traže vlasnikovu odluku prije naplate/produkcije. Probni način produžava trenutni rok i koristi istoriju posljednjeg paketa; to nije usvojeno komercijalno pravilo. Oporavak je za chat podatke; ne prenosi privatne liste osnovnog sajta.

## Šta čeka odobrenje

1. Kompletan chat/prepare-test.sql: samo nova testna šema i servisni RPC, uz postojeću administratorsku provjeru. Testni grantovi počinju isključeni.
2. Nakon odobrenja: postavljanje chat-test-api i pregledanog testnog paketa na /test/, uz zadržanu staru verziju. Ne objavljivati korijenski glavni sajt.
3. Tek nakon stvarnog testiranja: odvojeno odobrenje postojeće launch/prepare-live.sql osnove, glavnog endpointa i glavne objave. Osnovni model je sada besplatan.
4. launch/archive-legacy-after-cutover.sql je zaseban kasniji korak: arhivira pristupom, zadržava stare redove i zatvara stare javne API-je. Nikada ga primijeniti dok stari glavni sajt još zavisi od tih tabela. Arhiviranje na serveru još nije izvršeno.

Vlasnik ne treba pisati kod ili SQL. Nakon izričitog odobrenja pomoćnica izvršava samo odobreni tačan korak i provjerava rezultat.

# Probni anonimni chat i besplatni osnovni sajt

Ova priprema nije objavljena. Glavni sajt, /test/, postojeći podaci i ranije kopije nisu promijenjeni. Važi PROJECT_RULES.md od 25.10.2026; stari reklamni model 3/2/1 je ukinut izričitom odlukom vlasnika.

## Šta radi

Jedna soba, anonimni automatski profil i osam unaprijed pripremljenih avatara. Paketi 24h/7d/30d imaju istoriju 1/7/31 sat, prema serverskom vremenu. Nove poruke se provjeravaju svakih 1,5 sekundi; ne šalje se nezaštićen javni Realtime kanal. Server pri svakom osvježavanju ponovo provjerava rok i blokade. Starije stranice istorije takođe podliježu istim pravilima. Istek ili zabrana brišu poruke iz prikaza; server ih dalje ne isporučuje.

Administratorske probne kupovine paketa, nadimka i avatara su odvojene, idempotentne i evidentirane. Zaštita je dvostruka: CHAT_TEST_GRANTS_ENABLED na testnom serveru i eksplicitno uključivanje testnih grantova kroz potvrđenu administratorsku sesiju. Obični korisnik nema put za samostalno dobijanje probnih prava. Gateway u produkcijskom režimu po zadatim postavkama odbija sve testne kupovine.

Oporavak koristi kriptografski nasumičan ključ od 256 bita koji se prikaže samo korisniku, bez trajnog browser skladištenja. U bazi ostaje SHA-256 otisak. Oporavak u svježoj anonimnoj sesiji prenosi chat identitet, prava, poruke, blokade, zabrane i avatar i rotira ključ. Ne mijenja Auth lozinke ni administratora. Ne prenosi postojeće privatne liste osnovnog sajta: ta šira migracija identiteta nije implementirana.

## Kako isprobati lokalnu pripremu

`npm run dev` pokreće lokalni PostgreSQL-compatible testni server bez veze sa Supabase, stvarnim porukama e-maila, Turnstile verifikacijom ili naplatom. Baza je probna i nestaje nakon gašenja procesa. Postojeći podaci nisu kopirani u nju. Server koristi iste pripremljene chat SQL funkcije i gateway kao budući testni endpoint, uz lokalnu Auth zamjenu.

1. Otvori pregled sajta, meni → Anonimni chat → Otvori moj chat nalog.
2. Otvori `chat-admin.html` u lokalnom pregledu. Privatni vlasnički ključ nalazi se isključivo u `.local-stage/owner-key` i unosi se kroz lokalnu administraciju. Nije dio javnog koda, konfiguracije ili HTTP odgovora. Ovo je lokalna testna zamjena, ne Supabase prijava.
3. U administraciji uključi probna prava, učitaj anonimne naloge, izaberi nalog i dodijeli jedan od tri paketa.
4. U chatu pritisni „Provjeri paket i profil“. Napiši poruku. Druga anonimna sesija s dodijeljenim paketom vidi je bez ručnog osvježavanja stranice.
5. Zasebno dodijeli probni nadimak ili avatar, pa ponovo provjeri profil.
6. Prijavi/blokiraj poruku. Administrator kroz pregled poruka vidi razlog i može ukloniti, vratiti ili blokirati autora.
7. Sačuvaj ključ za oporavak i probaj ga u novom anonimnom nalogu prije otvaranja njegovog chat profila. Nakon oporavka sačuvaj novi ključ; stari je opozvan.

Automatski testovi pomjeraju vrijeme isključivo u lokalnoj bazi da provjere isteke i 15 dana rezervacije; u stvarnom korisničkom API-ju ne postoji „promijeni vrijeme“ ili „istekni paket“ radnja.

## Priprema stvarnog /test/

1. Vlasnik pregleda i odobri kompletan chat/prepare-test.sql. On pravi samo novu chat_test šemu i servisni RPC; postojeće tabele i podaci ostaju.
2. Primijeniti jednom, pregledati stanje prije ponavljanja. Postaviti poseban chat-test-api iz chat/index.ts i chat/gateway.mjs; server tajne ostaju u Supabase.
3. Omogućiti probne grantove samo tom testnom endpointu; dodatno ih uključiti iz postojeće administracije nakon lozinke i e-mail koda.
4. Pokrenuti `node scripts/build-test-review.mjs`. Generiše .test-review kopiju s postojećim testnim API-jem i izolovanim testnim sesijama, bez promjene dist/.
5. Tek nakon pregleda i odobrenja prenijeti pregledane testne fajlove u /test/, uz sačuvanu staru verziju. Ne mijenjati korijenski glavni sajt. Pregledati pravu e-mail prijavu, CAPTCHA i pristup iz dva preglednika.

## Odluke prije stvarne naplate / produkcije

Cijene, SMS pružalac i ugovor nisu izabrani. Dodatno potvrditi komercijalno pravilo kupovine novog paketa tokom aktivnog paketa. Samo u probnom režimu novi paket produžava pristup od kasnijeg od sadašnjeg roka/sada, a posljednji paket određuje istoriju; ovo nije odluka o budućoj naplati. Nema automatskog obnavljanja.

Potrebna je konačna odluka o roku čuvanja chat poruka, postupku prigovora i uslovima za maloljetnike prije javnog pokretanja. Pomična istorija ograničava isporuku, ne briše podatke. Moderatorske poruke su dostupan sadržaj samo za ovlaštenog administratora. Ne voditi zapis sirovih ključeva za oporavak, Auth tokena ili telefonskih brojeva u opštim logovima.

Anonimna zabrana blokira postojeći nalog; ne može sama garantovati zabranu osobe koja napravi potpuno novi nalog na drugom uređaju. Prije produkcije potrebni su sigurni rubni limiti kreiranja sesija i nadzor zloupotreba, bez javnog identifikovanja korisnika.

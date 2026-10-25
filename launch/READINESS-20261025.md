> ISTORIJSKA PROVJERA PRIJE NOVE ODLUKE. Naknadna izričita odluka vlasnika 25.10.2026. ukinula je 3/2/1. Aktuelna specifikacija je PROJECT_RULES.md, a završna provjera chat/VERIFICATION.md. Ovaj izvještaj se ne koristi kao plan primjene.

# Provjera prije završnog objavljivanja — 25.10.2026.

Status: BLOKIRANO ZA OBJAVLJIVANJE. Ova provjera nije migracija ni odobrenje primjene.

## Stvarno stanje servera

Supabase je ACTIVE_HEALTHY. Evidencija migracija sadrži samo:

- 20261024091501 — add_isolated_community_test_v2
- 20261024104014 — test_admin_restore_turnstile_activation_scoped
- 20261024125004 — test_admin_email_verification_with_guarded_cutover
- 20261024134816 — test_comment_submission_receipt
- 20261024142108 — test_submission_idempotency

Provjerene su i stvarne tabele i funkcije: community_live ne postoji. community-live-api nije postavljen. community-test-api je aktivan, verzija 4. Postoji samo raspored objavljivanja za community_test. Ne ponavljati pet postojećih migracija.

Jedan postojeći administrator i njegov Auth nalog su sačuvani. Potvrđen e-mail i postojeća lozinka su prisutni; metoda potvrde je email. CAPTCHA je uključena i šifrovani ključ je prisutan. Direktne dozvole anon/authenticated na testnu šemu, tabele i servisne RPC funkcije su odbijene. Tajni podaci nisu izvezeni u ovaj dokument.

Privatna ranija kopija aplikacijskih podataka je dostupna i njeni SHA-256 otisci su provjereni. Sadržaj i glasovi se podudaraju s tom kopijom. Privatne liste i pojedini operativni podaci su se u međuvremenu mijenjali; prije bilo kakvog budućeg odobrenog prelaska treba osvježiti kopiju. Ovo nije puna Auth/PITR kopija; Auth naloge i serverske tajne sačuvati u postojećem projektu.

## Ispravke samo u razvojnoj pripremi

- Obrazac prijave sadržaja sada koristi svoj status slanja, bez nepostojećih varijabli. Odbija dvostruki klik dok čeka odgovor i dopušta ponovni pokušaj poslije greške.
- Početna provjera objavljivanja odbija neprazan zvanični feed. Kasnije redovne objave sajta ne zahtijevaju prazan feed.
- Provjera objavljivanja odbija nedostatak serverske politike 3/2/1, promijenjene kvote i besplatno objavljivanje. Polje health.reward_policy mora imati server_enforced:true, confession:3, reply:2, comment:1, free_posting:false. Ovo je kontrola pripreme, a ne zamjena za stvarni server i transakcijsko trošenje prava. Ne dodavati samo ovu tvrdnju u API bez implementacije i provjere servera.
- AGENTS.md i PROJECT_RULES.md preneseni su u ovu pripremu.

76 lokalnih testova prolazi (prethodnih 72 i četiri dodatne provjere). Zasebna ranija reklamna demonstracija ponovo prolazi 85 testova; ona nije integrisana u ovu granu niti je serverska zaštita. Vanjski Auth/Turnstile servisi su u lokalnim testovima zamijenjeni. Nije izvršena stvarna administratorska prijava niti slanje sadržaja u novu zvaničnu šemu, jer ona ne postoji.

Svi dist/ fajlovi (izvor za postojeći /test/) ostaju identični prethodnoj pripremi. CSS i dizajn nisu mijenjani. GitHub main i postojeći produkcijski PR nisu promijenjeni ovim radom.

## SQL za pregled, bez izvršavanja

Postojeći puni tekst je u prepare-live.sql (756 redova) i activate-publisher.sql. Ni jedna datoteka nije promijenjena ovom provjerom:

- prepare-live.sql SHA-256: 7ecaa88a6850c575964b0b621e837713ae5cc3ab5d5fef2ffc91c91eea4f8f17
- activate-publisher.sql SHA-256: b91d5ab265445f4ab81c0e9b6e2b615a389def4dc91627fb2edf51123ed419ba

Prva skripta u jednoj transakciji stvara novu praznu community_live šemu, zasebne tabele/RPC funkcije i kopira samo postojećeg vlasnika i šifrovana sigurnosna podešavanja. Objavljivanje ostaje pauzirano. Ne mijenja postojeći sadržaj i ne kopira Auth lozinke. Zaustavlja se ako šema već postoji. Druga zasebno aktivira raspored i objavljivanje. Nijedna nije pokrenuta.

To je nepotpuna osnova: nema reklamnih prava na serveru. Završni SQL mora obuhvatiti dogovorena pravila i biti prikazan vlasniku u cijelosti prije novog odobrenja. Ne tražiti odobrenje starog SQL-a kao da je spreman za završno objavljivanje.

## Arhiviranje i preostale prepreke

Stare probne objave moraju ostati sačuvane. Plan je zadržati stare tabele kao arhivu i novu javnu verziju povezati isključivo s praznom community_live šemom. /test/ ostaje vezan za community_test. Nema DELETE/TRUNCATE/DROP radi čišćenja. Samo odvajanje novih podataka ne zatvara stare javne API puteve; prije prelaska treba pregledati i vlasniku prikazati zaseban plan njihovog pristupa, bez narušavanja /test/. Arhiva još nije primijenjena niti su stare objave sada skrivene.

Stvarna nagrađena mreža i serverski saldo nisu implementirani. Potrebna je potvrda dozvoljenog dobavljača/modela, zatim implementacija prava po radnji i atomskog trošenja samo poslije uspješnog upisa. Nema besplatne alternative i nema samostalne promjene poslovnih pravila.

Supabase security advisor ima postojeće napomene: rls_auto_enable je event_trigger, pa napomena o javnom EXECUTE sama po sebi nije dokaz dostupne obične RPC funkcije; cron politike treba tumačiti zajedno s pristupom šemi; zaštita od kompromitovanih lozinki nije uključena. Nisu mijenjane dozvole ni Auth podešavanja. Info nalaz o testnim tabelama bez RLS politika odgovara namjernom pristupu kroz server uz odsustvo direktnih klijentskih dozvola.

Sljedeći pregled za odobrenje mora sadržati završni tačan SQL, provjeru usklađenog reklamnog servera, osvježenu privatnu kopiju, nedestruktivni plan arhiviranja i završnu provjeru odvojenosti /test/.

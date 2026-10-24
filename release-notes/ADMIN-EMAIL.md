# Administratorska prijava: lozinka i e-mail kod

Postavljeno 24.10.2026. Vlasnik je uspješno dovršio stvarnu prijavu lozinkom i kodom na e-mail. Standardni testni administratorski pristup sada koristi e-mail potvrdu, bez TOTP/QR kodova.

Postojeća objavljena verzija sačuvana je u `backup/before-email-admin-20261024` na commitu `1bdc67c6bf4c69879fbfe721605da1021f14d342`. Raniji privatni backup sadržaja i strukture ostaje dostupan. Ova priprema ne mijenja podatke niti glavni sajt.

## Redoslijed primjene

1. Kroz Supabase Dashboard pročitati i sačuvati trenutni Magic Link šablon i stanje SMTP bez iznošenja tajni u chat/GitHub. Povezani alat nema Auth config operacije; za browser fallback zatražiti dozvolu korisnika.
2. Provjeriti da šablon za e-mail OTP sadrži `{{ .Token }}`. Ugrađeni Supabase mailer je za testove samo članovima organizacije, uz trenutno ograničenje 2 poruke/sat. Za zvanični rad povezati SMTP. Ne mijenjati globalni CAPTCHA ili anonimni Auth.
3. Ako je e-mail dostupan, primijeniti `supabase/admin-email.sql`, zatim novu verziju samo `community-test-api`, te samo `test/admin.html` i `test/admin.js`. Sve ostale datoteke glavne stranice ostaju iste. Sačuvati aktuelni glavni SHA i provjeriti originalni root HTML blob prije/poslije.
4. Vlasnik unosi lozinku u privatni panel, traži kod i unosi kod iz e-maila. Ne tražiti lozinku/kod u chatu. Pozitivno slanje/uručenje i unos stvarnog koda još nisu provjereni.

## Zaštita

- Lozinku provjerava Supabase Auth; gateway prihvata početak i provjeru koda samo uz Auth-potvrđeni password AMR mlađi od 10 minuta. Samostalna e-mail/magic link sesija nema administratorsku dozvolu.
- Privatna tabela `community_test.admin_email_sessions`, RLS, bez direktnih privilegija za javnost. Serverska potvrda vezana za tačan aktivni Auth session_id i vlasnikov UID, traje do 8 sati. Svaka administrativna DB radnja provjerava tu potvrdu i važeću Auth sesiju. Native AAL2 se ne oponaša.
- Nasumičan izazov 256 bita, samo SHA256 u bazi, važenje 10 minuta, najviše 5 pokušaja, najmanje 60 sekundi između slanja. Pogrešni pokušaji se trajno broje; pogrešan izazov ne zove Auth verifikaciju.
- Auth provjerava kod i jednokratnost. Gateway upoređuje potvrđeni UID/e-mail s jednim vlasnikom. Kod i lozinka se ne šalju SQL-u.
- Stari TOTP faktori se uklanjaju putem Auth Admin API-ja samo nakon uspješne potvrde e-maila. Ako je uklonjeni faktor bio potvrđen, Supabase opoziva sesije: potreban je novi ulazak lozinkom i e-mail kodom. Nema rutinskog isključivanja zaštite radi oporavka.
- Tajni ključevi, lozinke, kodovi i Auth sesije nisu u javnom kodu.

## Testovi

`npm test`: svih 50 testova prolazi. SQL na izolovanom PGlite/PostgreSQL okruženju; Auth i Cloudflare transporti su simulirani. Pokriveni su neuspjeli/istekli/iskorišteni kodovi, 5 pokušaja, zabrana preskakanja, passwordless odbijanje, nedostupan mailer, uklanjanje starog neaktiviranog TOTP faktora nakon potvrde, RLS/ACL, opozvane i istekle sesije, kao i postojeći red, glasovi, privatne liste, prijave, uklanjanje/vraćanje i CAPTCHA. Ručni pozitivni e-mail test i pregled na telefonu čekaju podešavanje šablona i vlasnika.

## Stanje nakon SMTP pripreme — 24.10.2026.

Vlasnik je na telefonu napravio Resend nalog, unio Sending access API ključ direktno u Supabase SMTP, sačuvao SMTP i Magic Link/OTP šablon sa `{{ .Token }}`. Ključ nije preuzet u radno okruženje niti javni kod.

Stvarni Auth OTP zahtjev na vlasnikov e-mail prihvaćen je HTTP 200. To potvrđuje prihvatanje slanja, ne isporuku u Gmail ili uspješnu prijavu.

Primijenjena je migracija `test_admin_email_verification_with_guarded_cutover`, a `community-test-api` je aktivna verzija 3. Novo polje `admin_auth_method` inicijalno ostaje `totp`. Stari AAL2 pristup ostaje važeći dok vlasnik ne potvrdi prvi stvarni e-mail kod. Nakon potvrđenog koda server prelazi na `email`; od tada AAL2 bez session-bound e-mail potvrde nije dovoljan. Stari TOTP faktor se uklanja samo nakon Auth-provjerenog e-maila. U ovom projektu stari faktor je bio neprovjeren, pa njegovo uklanjanje ne treba opozvati aktivnu sesiju.

Probni frontend je zaseban `/test/admin-email.html` sa `/test/admin-email.js`. Standardni `/test/admin.html` i glavni index.html ostaju prethodna verzija do vlasnikove potvrde. Nakon uspješnog vlasnikovog testa treba objaviti isti provjereni email UI kao normalni `/test/admin.html` i admin.js.

Svih 52 automatska testa prolaze. Dodate provjere: očuvanje TOTP pristupa prije pozitivnog e-mail testa; zabrana starog AAL2-only pristupa nakon prelaska na email. Otisci postojećih podataka u 11 sadržajnih/administratorskih tabela prije i poslije migracije identični su. Novi privatni store ima RLS i nema anon/authenticated read/execute privilegije. Rezervni ZIP prošao je CRC provjeru. Root index ostaje originalni blob 9f83f627a4917953a70b4efe9c01a05a5c130372.

Sigurnosni advisor prijavljuje privatne RLS tabele bez javnih policies (namjerni deny-all za direktni klijentski pristup). Ostali nalazi vezani su za ranije public.rls_auto_enable, cron policies i globalno isključenu provjeru kompromitovanih lozinki; nisu mijenjani ovom migracijom. Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable i https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .


## Potvrđen vlasnikov test

Vlasnik je poslao sliku uspješno otvorenog panela na telefonu. Serverski potvrđeno: admin_auth_method=email, jedna važeća e-mail potvrđena sesija, preostalih TOTP faktora 0. CAPTCHA je još isključena i čeka da vlasnik unese postojeće Cloudflare ključeve kroz panel. Objavljuje se isti provjereni email UI kao standardni test/admin.html i test/admin.js. Glavni index i legacy funkcije ostaju nepromijenjeni.

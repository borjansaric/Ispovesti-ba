# Administratorska prijava: lozinka i e-mail kod

Pripremljeno 24.10.2026. Nije primijenjeno na aktivni `/test/` niti postojeću bazu.

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

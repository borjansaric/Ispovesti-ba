# Administracija i Turnstile — postavljeno na /test/

Ova promjena odnosi se samo na testnu putanju i testnu šemu. Ne briše sadržaj. Naslovna stranica ostaje ista.

## Administracija

Jedan glavni administrator. Jednokratni slučajni aktivacioni kod od 256 bita veže aktivaciju za unaprijed odobreni e-mail na serveru i briše se nakon prve uspješne aktivacije. U bazi se čuva samo SHA-256 tog koda. Lozinku vlasnik sam unosi preko HTTPS u formu; nije u URL-u, GitHubu ni SQL-u. Auth Admin API pravi potvrđen nalog; ponovni pokušaj za postojeći nalog zahtijeva ispravnu lozinku, bez resetovanja. Nakon prijave obavezan je TOTP. Server provjerava potpisan Auth token, AAL2, aktivnu sesiju i članstvo. AAL1 može samo provjeriti sopstveno članstvo prije TOTP podešavanja, bez čitanja sadržaja ili postavki. Admin sesija se čuva u sessionStorage.

Prijave obuhvataju sve vrste sadržaja. Uklanjanje je arhiviranje. Vraćanje čuva ranije stanje: ispovijest koja je čekala red ponovo čeka red. Vraćanje roditelja ne vraća posebno uklonjene odgovore. Arhiva prikazuje i naslijeđeno skrivenu granu.

## Turnstile

Provjera se izvršava prilikom slanja ispovijesti, komentara i odgovora. Widget se prikazuje samo ako traži interakciju. Server poziva Cloudflare Siteverify i provjerava success, hostname, action i vrijeme izazova. Cloudflare jednokratnost odbija ponovnu upotrebu tokena. Neispravna provjera ne može doći do upisa sadržaja. Podešavanja važe samo za testni gateway, ne uključuju globalnu Supabase Auth CAPTCHA koja bi uticala na staru naslovnu.

Vlasnik može uključiti ili isključiti zaštitu u panelu. Uključivanje zahtijeva uspješnu stvarnu provjeru s odabranim ključevima. Dokumentacioni probni ključevi su zabranjeni. Tajni ključ se šifruje AES-GCM na serveru ključem izvedenim iz postojeće serverske tajne. Ne šalje se klijentu niti u SQL u otvorenom obliku. Nakon rotacije osnovne serverske tajne Turnstile ključ treba ponovo unijeti; ovo je namjerno zatvaranje pristupa pri nemogućnosti dešifrovanja.

Vlasnik je napravio stvarni Cloudflare widget i ima ključeve. Njih još treba unijeti kroz zaštićeni panel; do uspješne provjere zaštita ostaje isključena. Pripremljena forma prima sitekey i tajni ključ bez pisanja koda. U Cloudflare nalogu treba besplatni Managed widget za hostname borjansaric.github.io.

## Provjere

Prolaze 45 automatizovanih provjere nad stvarnom lokalnom PostgreSQL/PGlite bazom, lokalnim HTTP serverom i gatewayem. Auth transport i Cloudflare odgovori u novim integracionim provjerama su simulirani. Vlasnik treba lično završiti aktivaciju, TOTP i stvarni widget da bi se potvrdilo kompletno korišćenje u pregledniku. Nije korišćen probni Cloudflare ključ kao produkciona zaštita.

Kopija podataka prije izmjena provjerena je lokalnim PostgreSQL vraćanjem 112 redova iz 14 tabela. Plan čišćenja je privatan, zahtijeva zasebnu potvrdu i svjež inventar, i ne briše Auth korisnike, administratora ni podešavanja. Nije izvršen na postojećoj bazi. To je kopija sadržaja i strukturnih metapodataka, ne provider-level PITR ili backup lozinki/MFA tajni.

## Primjena nakon izričitog odobrenja

Postavljene su testne SQL funkcije, testni gateway i frontend isključivo pod /test/. Prvobitni zahtjev za dodatni Auth grant je uklonjen: nikakva nova prava na auth.users nisu dodata. Identitet i potvrda e-maila provjeravaju se preko Auth servisa, a SQL provjerava članstvo, aktivnu sesiju i testne dozvole.

Kontrolni zbirovi starog sadržaja i njegovih grantova prije i poslije primjene su jednaki. Naslovna ima isti originalni Git blob. Rezervna kopija je dostupna i provjerena, a plan čišćenja nije izvršen. Aktivacioni pristup je privatno izdat vlasniku, važi 48 sati i koristi se samo jednom. Vlasnik tek treba izabrati lozinku, završiti TOTP i unijeti Cloudflare ključeve. Ni lozinka, aktivacioni kod, stvarni Cloudflare ključevi ni servisni ključevi nisu u ovom repozitorijumu.

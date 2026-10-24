# Administracija i Turnstile — pripremljeno, još nije postavljeno

Ova promjena odnosi se samo na testnu putanju i testnu šemu. Ne briše sadržaj. Naslovna stranica ostaje ista.

## Administracija

Jedan glavni administrator. Jednokratni slučajni aktivacioni kod od 256 bita veže aktivaciju za unaprijed odobreni e-mail na serveru i briše se nakon prve uspješne aktivacije. U bazi se čuva samo SHA-256 tog koda. Lozinku vlasnik sam unosi preko HTTPS u formu; nije u URL-u, GitHubu ni SQL-u. Auth Admin API pravi potvrđen nalog; ponovni pokušaj za postojeći nalog zahtijeva ispravnu lozinku, bez resetovanja. Nakon prijave obavezan je TOTP. Server provjerava potpisan Auth token, AAL2, aktivnu sesiju i članstvo. AAL1 može samo provjeriti sopstveno članstvo prije TOTP podešavanja, bez čitanja sadržaja ili postavki. Admin sesija se čuva u sessionStorage.

Prijave obuhvataju sve vrste sadržaja. Uklanjanje je arhiviranje. Vraćanje čuva ranije stanje: ispovijest koja je čekala red ponovo čeka red. Vraćanje roditelja ne vraća posebno uklonjene odgovore. Arhiva prikazuje i naslijeđeno skrivenu granu.

## Turnstile

Provjera se izvršava prilikom slanja ispovijesti, komentara i odgovora. Widget se prikazuje samo ako traži interakciju. Server poziva Cloudflare Siteverify i provjerava success, hostname, action i vrijeme izazova. Cloudflare jednokratnost odbija ponovnu upotrebu tokena. Neispravna provjera ne može doći do upisa sadržaja. Podešavanja važe samo za testni gateway, ne uključuju globalnu Supabase Auth CAPTCHA koja bi uticala na staru naslovnu.

Vlasnik može uključiti ili isključiti zaštitu u panelu. Uključivanje zahtijeva uspješnu stvarnu provjeru s odabranim ključevima. Dokumentacioni probni ključevi su zabranjeni. Tajni ključ se šifruje AES-GCM na serveru ključem izvedenim iz postojeće serverske tajne. Ne šalje se klijentu niti u SQL u otvorenom obliku. Nakon rotacije osnovne serverske tajne Turnstile ključ treba ponovo unijeti; ovo je namjerno zatvaranje pristupa pri nemogućnosti dešifrovanja.

Cloudflare nalog još nije povezan i stvarni widget/ključevi nisu napravljeni. Zato se zaštita ne smije označiti kao aktivna. Pripremljena forma prima sitekey i tajni ključ bez pisanja koda. U Cloudflare nalogu treba besplatni Managed widget za hostname borjansaric.github.io.

## Provjere

Prolaze 44 automatizovane provjere nad stvarnom lokalnom PostgreSQL/PGlite bazom, lokalnim HTTP serverom i gatewayem. Auth transport i Cloudflare odgovori u novim integracionim provjerama su simulirani. Vlasnik treba lično završiti aktivaciju, TOTP i stvarni widget da bi se potvrdilo kompletno korišćenje u pregledniku. Nije korišćen probni Cloudflare ključ kao produkciona zaštita.

Kopija podataka prije izmjena provjerena je lokalnim PostgreSQL vraćanjem 112 redova iz 14 tabela. Plan čišćenja je privatan, zahtijeva zasebnu potvrdu i svjež inventar, i ne briše Auth korisnike, administratora ni podešavanja. Nije izvršen na postojećoj bazi. To je kopija sadržaja i strukturnih metapodataka, ne provider-level PITR ili backup lozinki/MFA tajni.

## Blokada postavljanja

Automatska provjera odbila je primjenu migracije na postojećem Supabase projektu jer traži dodatno konačno odobrenje za upis. Novi SQL i frontend zato još nisu postavljeni. Postojeća testna verzija nastavlja da radi kao ranije. Nakon potvrde treba primijeniti admin-captcha.sql, postaviti gateway, izraditi privatni aktivacioni hash vezan za vlasnika i objaviti samo promijenjene test/ datoteke.

# Administratorski oporavak lozinke — testna priprema 27.10.2026.

Status: kod i SQL pripremljeni; **nije aktivirano, nije javno postavljeno, postojeća lozinka i sesije nisu promijenjene**. Glavni sajt i produkcijski paket nisu dobili recovery UI. Osnovna prijava i e-mail kod ostaju.

## Korisnički tok

Na /test/admin.html dodaje se diskretno „Zaboravljena lozinka?“. Administrator unosi potvrđeni e-mail, završava Turnstile i dobija uvijek isti odgovor, bez potvrđivanja postojanja naloga. Samo unaprijed postojeći administrator čiji se UID podudara sa serverskom dozvoljenom vrijednošću i potvrđenim Auth e-mailom može dobiti poruku.

Link otvara /test/admin-recovery.html. Tajna je 256-bitna kriptografski slučajna vrijednost, prenosi se u fragmentu URL-a, odmah se uklanja iz adrese i ostaje samo u memoriji stranice. Ne čuva se u localStorage/sessionStorage, logovima, dijagnostici ili podacima aplikacije. Baza čuva samo SHA-256 verifikator. Mail servis nužno prima link radi dostave; prije aktivacije isključiti click/open tracking i provjeriti retenciju e-maila. GET/pretpregled linka ne troši token. Osvježavanje otvorene stranice gubi token; originalni link može ponovo otvoriti istu formu ako još nije potrošen/istekao.

Token važi 10 minuta, koristi se jednom i novi izdati link poništava prethodni. Najviše jedno izdavanje u 60 sekundi i tri u satu po administratoru, uz obavezan serverski Turnstile čak kada je CAPTCHA za objavljivanje isključena. Ne preuzimati email/UID/redirect iz browsera kao autoritet. Klijent ne šalje administratorov JWT; reset ne koristi postojeću prijavu kao dokaz vlasništva.

Poslije unosa nove lozinke (12–128 znakova), server atomskom SQL radnjom troši token, privremeno blokira administratorske radnje, evidentira postojeće testne administratorske sesije kao opozvane i poništava njihovu e-mail potvrdu. Zatim potvrđuje postojeći Auth UID/e-mail, mijenja samo password atribut tog naloga, dobija kratkotrajnu sesiju u odvojenom serverskom Auth klijentu i eksplicitno poziva global signOut. Tajna lozinka i JWT nikada nisu u odgovoru browseru. Završni SQL opoziva i sesije nastale tokom promjene, ponovo poništava e-mail potvrdu i skida privremenu blokadu. Slijedi nova prijava lozinkom i novim e-mail kodom. Ne stvara nalog, ne daje ulogu, ne mijenja app_metadata ili email, ne uklanja MFA faktore i ne potvrđuje e-mail kod umjesto korisnika.

Važeći stari JWT sam po sebi nije dovoljan: community_test.assert_admin dodatno odbija opozvani session_id ili privremenu blokadu. Isti provjereni guard koristi testna chat administracija, bez izmjene chat interfejsa, paketa ili podataka. U slučaju greške tokom Auth promjene ne vraća se automatski token, ne ponavlja se password upis i ne skida se blokada; potrebna je ručna, pregledana provjera Auth/SQL stanja i oporavak. To je namjerna zaštita kod neizvjesnog djelimičnog uspjeha.

## Šta je testirano

Osam novih testova: SQL odobrenje i zabrana ponavljanja; očuvanje postojeće lozinke i administratorskog naloga pri samoj pripremi; anon/authenticated bez čitanja/EXECUTE; pogrešan e-mail; ograničenje frekvencije; istek; konkurentno dvostruko korišćenje; neposredno odbijanje starih i usput nastalih sesija; nova sesija i dalje mora dobiti e-mail dokaz; odbijanje lažnog UID/session_id/aal; potvrđeni postojeći vlasnik; CAPTCHA; skrivanje postojanja naloga uključujući grešku mail servisa; Origin/metod/veličina; djelimična greška; skrivanje lozinki/JWT-a; uklanjanje URL fragmenta; izolovan serverski Auth klijent i izričiti global signOut. Izvještaj cijelog regresionog skupa nalazi se u manifestu ove dopune.

To su lokalni PGlite i simulirani Auth/mail/Turnstile testovi, uz provjeru stvarnog Edge adaptera sa zamjenama SDK-a. Nije izvršena prava promjena lozinke, dostava maila niti vizuelna provjera u mobilnom/desktop browseru. Ne predstavljati ih kao stvarni E2E.

## Neophodno prije javne testne probe

1. Pregled i izričito odobrenje cijelog supabase/admin-password-recovery-test.sql. DDL stvara samo dvije community_test tabele, jedan servisni RPC i dopunjuje postojeći assert_admin uz očuvane ranije provjere. Ne prepisuje Auth, sadržaj, liste, administratora ili kopije. Runtime reset namjerno opoziva administratorski pristup; to nije izvršeno pripremom. SQL ne sadrži produkcijsku šemu i ne daje browseru privilegovani pristup.
2. **Izolacija Auth-a:** /test/ sada koristi isti Supabase Auth nalog kao buduća glavna administracija. Stvarno mijenjanje te lozinke/globalni signOut zato nisu ograničeni prefiksom /test/. Za probu treba zaseban Supabase Auth projekat sa probnim vlasnikom, ili posebno odobrenje za kontrolisanu promjenu stvarnog postojećeg naloga. Nijedan probni nalog/lozinka nije kreiran niti preseljen ovim zadatkom. Ne prepisivati vlasnika postojećeg testnog chata. Ako se koristi zaseban projekat, u njemu pripremiti izolovanu fixture šemu bez privatnih produkcijskih podataka i poseban recovery-only panel/config.
3. Edge Function admin-recovery-test-api, verify_jwt=false jer se radi bez prijave; sve privilegovane radnje zasnivaju se na jednokratnom email tokenu i serverskom UID allowlist-u, ne na javnom JWT-u. Bundler mora uključiti admin-recovery/handler.mjs. Server zahtijeva: RECOVERY_ENVIRONMENT=test, RECOVERY_ENABLED=true, RECOVERY_AUTH_RESET_APPROVED=true, RECOVERY_OWNER_UID (tačan probni/posebno odobren stvarni UID), RECOVERY_LINK_URL (tačan HTTPS /test/admin-recovery.html), RECOVERY_TURNSTILE_SECRET, RECOVERY_RESEND_API_KEY, RECOVERY_FROM_EMAIL, te standardne serverske Supabase ključeve. Nijedan nije dodat niti otkriven.
4. Testni frontend dobija samo javni recoverySitekey u config.js; mora odgovarati dedicated tajni. Bez podešavanja forma jasno kaže da oporavak još nije aktiviran. Stara prijava radi nepromijenjeno. Resend adapter pripremljen je za ranije korišteni servis; nema slanja, kupovine ili promjene SMTP podešavanja. Provjeriti sender/domain, retenciju i tracking; API ključ ograničiti na slanje.
5. Posebno riješiti već prijavljenu granicu zajedničkog GitHub Pages deploymenta: prethodna automatska provjera odbila je main ref promjenu koja pokreće cijeli sajt. Nije ponovljena niti zaobiđena. Trenutne izmjene su na razvojnoj grani/lokalnom testnom paketu, ne na glavnoj adresi.
6. Poslije odobrenog izolovanog postavljanja: stvarni mail → link → nova lozinka → stari JWT i refresh odbijeni → stara lozinka odbijena → nova lozinka sama ne otvara tools → novi e-mail kod → panel → odjava. Posebno testirati istek i ponovni klik, bez slanja privatnih podataka ili lažnih javnih objava. Mobilni i desktop prikaz provjeriti tada.

## Potpuni SQL i izvori

Tačan SQL: ../supabase/admin-password-recovery-test.sql. Manifest sadrži SHA-256. Nema automatskog izvršavanja, rollback brisanja ili produkcijskog deploya.

- https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid — serverska promjena password atributa; service_role nikada browseru.
- https://supabase.com/docs/reference/javascript/auth-signout — globalna odjava i granica važenja već izdatih access JWT-ova; zato postoji dodatna serverska evidencija opozvanih sesija.
- https://resend.com/changelog/idempotency-keys — sprečavanje duplog slanja istog maila.

Supabase JS adapter je pinovan na 2.118.0, istu verziju već vendorizovanu u projektu. Postojeće zavisnosti nisu nadograđene.

# Povezivanje glavne administracije, chata i oporavka —30.10.2026.

## Naknadno završeno 30.10.2026. u 13:36 (Sarajevo)

Ovaj odjeljak zamjenjuje starije navode ispod o nepotvrđenoj glavnoj prijavi,
nepovezanom Resendu i otvorenom legacy API-ju. Vlasnik je slikama potvrdio
stvarni glavni administratorski pristup, zatim uključene recovery postavke.
Read-only provjera baze potvrdila je enabled=true i mail_configured=true;
ključ nije pročitan niti otkriven. Na zahtjev vlasnika preskočena je provjera
isporuke recovery e-maila i stvarna promjena lozinke. Ne predstavljati to kao
potvrđen end-to-end reset.

Poslije vlasnikovog „Dobro aj uradi sta treba“ primijenjena je migracija
finalize_legacy_archive_20261030 iz launch/finalize-legacy-20261030.sql.
Transakcija je zaključala šest starih public tabela, napravila dodatnu privatnu
kopiju legacy_archive_20261030 i uporedila sve redove EXCEPT ALL u oba smjera.
Ukupno 141 red: confessions17, comments25, votes2, private_user_lists91,
submission_limits6, test_spam0. Originalni redovi i ranije kopije ostaju.
Nema DELETE/TRUNCATE/DROP. Opozvane su sve dozvole PUBLIC/anon/authenticated/
service_role nad šest starih tabela; provjereni i column grants. Nema javnih
views ili izvršivih public funkcija koje bi zaobišle ovo zatvaranje.

Poslije migracije provjereno: nula otvorenih starih grantova, šest privatnih
kopija/141 red, glavni HTTP ready/live/CAPTCHA=true, svih šest starih REST
čitanja odbijeno. Advisors nema novih WARN nalaza; ostaju raniji sistemski
cron policy WARN i isključena Pro provjera kompromitovanih lozinki.
Snapshot je u istom projektu, nije nezavisna infrastrukturna/Auth/PITR kopija.
community_test/chat_test, /test/, glavni sadržaj, izgled i lozinka nisu mijenjani.

Preostalo: SMS provajder/ugovor/cijene i naplata, izbor oglašivača, konačni
pravni tekstovi/javni kontakt/domena i ranije nepovezana analitika/zakupi.
Nisu aktivirani troškovi niti predstavljena cijela šira specifikacija završenom.

Vlasnik je ponovo izričito zatražio završavanje preostalih dijelova poslije
objave osnovnog sajta. Postojeća odobrenja važe, bez novog probnog naloga,
isključivanja zaštite, redizajna, brisanja podataka ili dodatnih troškova.

## Stvarno postavljeno na glavnom projektu

roxajqagksffbsbzdrap sada ima chat_live, admin_archive_live i dodatne private
community_live recovery tabele. Izvori su live/*.sql; ne primjenjivati ponovo.
chat_live_core_tables/dispatch, complete_live_chat_room/auth/archive,
complete_live_admin_recovery/recovery_settings su uspješni. owner-chat.sql je
uspješno primijenjen, ali je alat poslije njegovog unutrašnjeg commit-a prijavio
sudar vremenske oznake u schema_migrations. Stvarno postojanje tabele/RPC-a je
provjereno, pa je upisana verify_live_owner_access_20261030 provjera. Nije
ponovljen owner DDL. Bez brisanja ili izmjena chat_test podataka.

- chat-live-api1: provjeren Supabase Auth, stvarni session_id u auth.sessions,
  owner+novi e-mail dokaz za moderaciju. RPC nije dostupan browser ulogama.
- Glavni chat: ista ad-free soba/UI, polling, istorija prema paketu1/7/31h,
  blokiranje/odblokiranje, prijave, anti-spam i idempotentno slanje. Paket je
  neophodan; nema besplatnog pristupa običnim posjetiocima ili testnih grantova.
  Probne radnje su blokirane i gateway-em i SQL-om, settings ima CHECK false.
  Stvarna naplata nije povezana; nema izmišljene SMS cijene/koda/kupljenog prava.
- Vlasnik može iz potvrđenog panela dodijeliti sebi poseban anonimni pristup.
  Server provjerava i owner sesiju i ciljnu anonimnu sesiju. Samo jedna ciljna
  sesija je aktivna; stara gubi pristup. Ovo ne daje anonimnom UID-u admin prava.
- Cijela glavna chat istorija, bez korisničkog vremenskog ograničenja za
  administratora:100+1 keyset, tekst/datum/anonimni ID/status, okolne poruke,
  prijave/audit, uklanjanje/vraćanje i zabrana/ukidanje zabrane. Trigger čuva
  nickname/avatar/publicID pri slanju. Stare probne poruke ostaju u chat_test;
  nisu predstavljene kao prave nove poruke, nisu obrisane.
- community-live-api2: postavke recovery mail servisa iza owner+OTP zaštite.
  Resend ključ se odmah šifruje AES-GCM postojećim server ključem. Čitanje
  postavki vraća samo status, adresu pošiljaoca i indikator da ključ postoji.
- admin-recovery-live-api1: fiksan HTTPS glavni link, obavezan Turnstile po
  zasebnoj admin_recovery radnji (postojeći pravi widget, čak i kada je zaštita
  objavljivanja isključena), token256bit/sha256,10min/jednom,1/min i3/h,
  generičan odgovor, serverska provjera jedinog ownera. Lozinka12–128, opoziv
  sesija, nova password+OTP prijava. Djelimična greška ostavlja blokadu i ne
  ponavlja password upis. Samo postavljanje nije promijenilo lozinku/sesije.

## Provjereno

34 relevantne lokalne provjere prošle: novi live PostgreSQL/PGlite tok,
prethodna recovery saga, chat gateway, arhivska paginacija, sigurnost paketa,
launch preflight i postojeći izgled. Live fixture205poruka: sve stranice bez
praznina/duplikata, stari avatar/nadimak poslije promjene profila, moderacija,
owner sesija/poništavanje prethodne i odbijanje tuđeg identiteta. Fixture podaci
nikada nisu slani u glavni projekat. /test/ i original.css/styles.css neizmijenjeni.

Stvarni HTTP: archive bez prijave401, trial grant403, recovery bez mail ključa503,
postavke bez prijave401. Glavni health i dalje ready/live/CAPTCHA. Nove tabele
imaju RLS i nemaju javni EXECUTE. Advisors nema novog live WARN nalaza.
Stvarna glavna admin prijava, slanje OTP/reset maila, Turnstile i promjena
lozinke nisu izvedeni umjesto vlasnika. Njegovi raniji screenshot-i potvrđuju
samo zasebnu probnu prijavu/OTP/odjavu.

## Tačno preostalo povezivanje

1. Glavni admin → Oporavak lozinke → Prikaži postavke: vlasnik sam unosi svoj
   Resend sending ključ, dozvoljenog pošiljaoca i uključuje oporavak. Trenutno
   mail_configured=false/enabled=false; javna opcija zato pošteno vraća503.
   Konektor ne omogućava čitanje/prebacivanje ključa iz Supabase SMTP postavki
   drugog projekta. Ključ se ne traži u razgovoru niti upisuje u javni izvor.
   onboarding@resend.dev ima ograničenje na vlasnički e-mail Resend naloga;
   za ostale primaoce potreban je verifikovan dozvoljeni sender/domain.
2. Stvarna SMS naplata zahtijeva izabranog provajdera, ugovor/cijene, vjerodostojan
   callback i dostavu. Nisu samostalno izmišljeni, aktivirani ili plaćeni.
   Vlasnički ulazak radi odvojeno; obični posjetioci nemaju kupljena prava.
3. Javni kontakt/pravni nacrti/domena i stvarne reklamne mreže ostaju ranije
   nedovršeni izbori. Analitika i reklamni zakupi iz admin-prep još nisu glavni
   obračunski/telemetrijski servis. Ne tvrditi da je cijela šira specifikacija gotova.

Objava preko postojećeg Pages allowlist postupka. U browser izlaz ulaze samo
klijenti, ne SQL, gateway/server adapteri ili servisni ključevi. Posebni site/probe
projekat ostaje sačuvan, ali novi glavni UI ga ne koristi. Novi Cloudflare widget
na telefonu nije potreban za ove glavne funkcije.

## Završna objava klijenata

Glavna objava4f226fa3706b90de83f0b1f98c01e3efcd22ae74 i oba Pages postupka
41035993357/41035992337 su uspješni. Browser je otvorio novi glavni chat,
koji ispravno prikazuje zatvorenu kupovinu bez paketa; nova glavna prijava
prikazuje Zaboravljena lozinka. Nije unesena lozinka, OTP ili sintetička poruka.

Provjera javnih datoteka je našla i uslovne testne adrese u generičkim root
klijentima, iako ih allowlist builder uklanja. Root klijenti su zato dodatno
ograničeni na glavni servis; testni generator je izdvojen u trial-client.mjs
samo za lokalni/testni admin. Review builderi eksplicitno prilagođavaju svoj
klijent. Zaštita na serveru već je odbijala probne radnje. Još20 relevantnih
provjera nakon ove dorade prošlo je, uključujući sandbox/test pakovanje.
Testno stablo i originalni CSS ostaju identični prethodnoj glavnoj objavi.

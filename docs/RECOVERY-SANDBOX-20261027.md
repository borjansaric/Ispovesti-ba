# Odvojena proba oporavka — priprema 27.10.2026.

**Status: odvojeni privatni Site registrovan, neobjavljen; Supabase projekat i Auth nalog još nisu kreirani. SQL nije primijenjen.** Ovaj plan zamjenjuje raniji prijedlog da se testira na zajedničkom administratorskom nalogu. Nema promjena glavnog sajta, /test/ servera, stvarne lozinke, sesija, podataka ili GitHub Pages podešavanja.

## Šta je stvarno pripremljeno

- Novi owner-private Sites prostor: project_id `appgprj_6ae0790b1fc88191b233d3dddf2b8ccf`. Očekivana buduća adresa je `https://ispovesti-admin-recovery-sandbox.jovialfrog11.chatgpt.site`; to **nije funkcionalan objavljen link**. Provjereno: current_live_url=null, verzija0, dozvoljen samo vlasnik, bez spoljašnjih posjetilaca/grupa. Nema deploya, povezivanja domene niti vezivanja za postojeći GitHub Pages workflow. Ovaj Site ID ponovo koristiti; ne praviti drugi.
- Samostalan statički panel pod /test/admin.html i /test/admin-recovery.html, isti postojeći crno-zlatni stilovi. Sadrži samo probnu prijavu, e-mail potvrdu, oporavak i odjavu. Nema pristupa sadržaju, privatnim listama, stvarnom moderatorskom panelu ili chatu. Ne predstavlja skraćeni panel kao zamjenu za postojeću administraciju.
- Builder scripts/build-recovery-sandbox.mjs radi lokalno, ne koristi GitHub API, nema SQL/HTTP upisa. Podrazumijevani izlaz je bez Supabase adrese/ključa i jasno neaktivan. Konfigurisan build zahtijeva novi tačno određeni projectRef/HTTPS Supabase URL i zaseban HTTPS origin; odbija oba postojeća projekta i glavne adrese. Browser ima samo javni ključ i sitekey, odvojenu sessionStorage oznaku, nikada service_role. Svi postojeći sajtovi ostaju na svom izvornom kodu.
- Namjenski login Edge izvor admin-recovery-sandbox-login i namjenski recovery izvor admin-recovery-isolated-api. Oba odbijaju postojeće projectRef-ove i zahtijevaju novi projektni allowlist. Postojeći community-test-api, chat-test-api, admin-recovery-test-api i produkcijski plan nisu postavljani/mijenjani. Recovery i dalje koristi testirani 256-bitni token, deset minuta, jednu upotrebu, CAPTCHA, ograničenje slanja, opoziv starih sesija i novu password+email prijavu.
- Cijeli novi bootstrap SQL: ../admin-recovery/sandbox/prepare-isolated.sql, samo nova recovery_sandbox šema i tri servisna RPC-a u **novom praznom projektu**. Šema sadrži samo vlasnički UID/e-mail i sigurnosno stanje probe. Čuva se referenca na novi Auth nalog; SQL ne kreira Auth naloge i ne upisuje lozinke. Guard traži posebno odobrenje, tačno jedan novi potvrđeni probni Auth nalog i prekida ako postoje community_test, community_live, chat_test, legacy confessions ili već recovery_sandbox. Nema prenosa postojećih redova/podataka. Samo service_role/Postgres zovu RPC; RLS i privatne tabele su uključeni. Ne izvršavati staru community_test recovery skriptu u stvarnom projektu radi ove probe.
- Pripremljen inviteSandboxAccount helper: radi samo uz izričitu potvrdu, novi dozvoljeni projekat i prazan Auth spisak. Šalje poziv novom probnom nalogu; nikada ne postavlja niti vraća lozinku. Nakon poziva korisnik potvrđuje e-mail i kroz probni oporavak bira probnu lozinku. Korisnik unosi sve kodove/lozinke direktno u panel. Ista e-mail adresa u dva odvojena Auth projekta ne povezuje njihove korisničke ID-jeve, lozinke ili sesije; ipak poziv i adresa moraju biti odobreni.

## Stanje organizacije i trošak

Read-only provjera pronašla je jednu organizaciju `borjansaric's ispovesti`, id `kfqymrixsrseywfobwvr`, Free plan. Postoje Ispovesti-ba (ACTIVE_HEALTHY) i borjansaric's Project (UNKNOWN). Drugi projekat nije pregledan radi podataka, prenamijenjen, pauziran, obrisan ili vraćen. Ne pretpostavljati da je prazan ili slobodan.

Zvanična cijena navodi najviše dva aktivna projekta na Free planu. UNKNOWN nije dokaz aktivnog ili oslobođenog mjesta, zato dostupnost besplatnog novog projekta još nije potvrđena. Nije pozvan create_project, confirm_cost ili get_cost: taj posljednji alat traži da vlasnik prvo izabere organizaciju. Prije kreiranja korisnik treba potvrditi organizaciju i uslov **0 KM dodatnog troška**. Zatim provjeriti stvarnu ponudu/alokaciju i nastaviti samo ako je dozvoljeno bez naplate. Ako nema besplatnog mjesta, stati i prijaviti tačnu prepreku. Ne uključivati Pro, dodatnu instancu s naplatom, promjenu organizacije ili korišćenje postojećeg drugog projekta na svoju ruku.

Izvor: https://supabase.com/pricing . Sites registracija nije objavljivanje niti dokaz da je Auth backend spreman; nema odobrene kupovine dodatnih usluga.

## Tačno odobrenje za sljedeći korak

Predloženi ograničeni obim, uz očuvanje zabrane svake promjene postojećih projekata:

1. Izabrati organizaciju `borjansaric's ispovesti` i odobriti kreiranje **novog** Supabase projekta `Ispovesti-recovery-sandbox`, region eu-central-1, samo uz potvrđen dodatni trošak0 KM. Ako ponuda nije0 KM ili kvota ne dozvoljava, ne kreirati i ne mijenjati postojeće projekte.
2. Potvrditi e-mail za novi probni administratorski nalog i slanje jednog poziva. Može biti postojeća vlastita adresa, jer je Auth projekat odvojen; može i druga adresa koju vlasnik kontroliše. Ne tražiti lozinku/kod u razgovoru. Helper mora prvo potvrditi prazan novi Auth spisak i sačuvati vraćeni novi UID; ne ponavljati poziv naslijepo nakon greške.
3. Izričito odobriti kompletan prepare-isolated.sql iz ovog paketa, **isključivo na tom novom projectRef-u**, poslije potvrde probnog e-maila. Prije toga uporediti SHA-256 s manifestom i projekat s allowlistom. Postaviti approval guard i probni UID samo u odobrenom izvršavanju. Ne izvršavati bilo koji SQL u roxajqagksffbsbzdrap ili wrvljpngjsinidbcpyaq.
4. Odobriti postavljanje samo dvije navedene probne Edge funkcije u novom projektu i njihova serverska podešavanja; bez produkcijskih funkcija. Podesiti mail sender/SMTP, Magic Link OTP šablon s {{ .Token }}, OTP expiry600, isključiti javnu/anonimnu registraciju samo u novom projektu, dozvoljeni redirect na ovaj privatni Site i namjenski Turnstile widget samo za njegov hostname. Ne mijenjati postojeći SMTP ili Turnstile widget. Stvarna mail dostava koristi odobreni e-mail servis, bez automatske kupovine. Sekrete unijeti kroz bezbjedne serverske postavke, ne u browser ili chat.
5. Odobriti **privatno objavljivanje samo novog Sites projekta**, bez GitHub Pages promjena, main ref-a ili workflow_dispatch. Prije objave izgraditi konfigurisani samostalni paket, sinhronizovati ga s izvornim repozitorijumom tog istog Site ID-ja, sačuvati verziju i objaviti owner-private native postupkom. Nije dozvoljeno postavljati cijeli postojeći GitHub repozitorijum. Objaviti samo dist samostalnog panela; nijedan SQL/Edge/server fajl ne ide u javni statički paket.

Ovi koraci nisu izvršeni u ovoj pripremi. Korak1 može početi nakon odobrenja organizacije/0KM; ako projektno mjesto nije dostupno, svi naredni koraci čekaju odluku vlasnika. Ranija automatska zabrana zajedničkog Pages deploymenta se ne ponavlja niti zaobilazi: ovo je drugi hosting projekat, drugi origin, drugi paket i odvojen Auth.

## Plan stvarnog testiranja poslije odobrenog postavljanja

- Poziv novom nalogu → potvrda e-maila → oporavak → izbor nove probne lozinke. Private Site dodatno zahtijeva vlasnički pristup kroz ChatGPT; provjeriti da se recovery fragment sačuva tokom eventualnog prelaza na tu prijavu. Ako platforma izgubi fragment, prijaviti prepreku, ne učiniti Site javnim bez odobrenja.
- Probna lozinka sama ne otvara panel → novi e-mail kod → probni panel. Browseru se ne šalje privilegovani ključ.
- Nova promjena lozinke: prethodna lozinka, stare Auth refresh sesije, stari administratorski JWT i stari e-mail dokaz moraju biti odbijeni. Nova prijava ponovo traži e-mail kod.
- Isti link drugi put i istekao link odbijeni; CAPTCHA i tri slanja/sat provjereni. Dvostruki submit ne pravi dvostruku promjenu.
- Mobilni i desktop pregled, dva preglednika za provjeru opoziva, odjava i ponovno otvaranje linka. Probne poruke šalju se samo odobrenom vlasničkom e-mailu; bez javnih sadržaja.
- Ako Auth operacija djelimično uspije, ostaje zatvoren pristup; pregledati samo novi projekat i ponuditi nedestruktivni oporavak. Ne prepravljati stvarni nalog niti povući podatke iz njega.

## Testovi ove pripreme i granice

142/142 lokalna testa prolazi: prethodnih135 i sedam novih. Novi testovi pokrivaju blokadu oba postojeća projectRef-a i glavnih origin-a, isključeno stanje bez konfiguracije, allowlist javnih statičkih datoteka, odbijanje postojećih Auth naloga pri pozivu, SQL odobrenje/novi prazan projekat/RLS, opoziv sesija i ponovnu e-mail potvrdu, ignorisanje lažnog UID/session_id/aal, stari password dokaz i pogrešan OTP. Dva nova TypeScript Edge izvora prolaze provjeru parsiranja. Podaci za testove su izmišljeni i lokalni.

Stvarni novi Supabase projekat/poziv/SMTP/Turnstile/E2E i vizuelni browser test još nisu izvršeni. Native Site ima samo registrovan identitet, bez sačuvane ili objavljene verzije. Nemamo funkcionalan link za probu dok ti koraci ne budu odobreni i provjereni.

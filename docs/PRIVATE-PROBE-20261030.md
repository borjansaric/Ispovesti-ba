# Privatna proba: stvarno stanje nakon odobrenja 30.10.2026.

Vlasnik je u ovom razgovoru odobrio dovršavanje i ranije predloženu odvojenu
privatnu probu, uz zadržan uslov 0 KM dodatnog troška. Nema potrebe ponavljati
odobrenje za taj isti obim. Odobrenje ne otkriva lozinke, kodove ili servisne
ključeve i ne zamjenjuje prijavu u upravljačke servise.

## Postavljeno

- Supabase: `rbufvpaovofusnndvgpv`, Ispovesti-recovery-sandbox, eu-central-1,
  u postojećoj Free organizaciji. Projekat je ACTIVE_HEALTHY; broj Auth korisnika
  je i dalje 0, aplikaciona šema nije primijenjena. Raniji stvarni projekat nije
  mijenjan. Ne ponavljati kreiranje projekta.
- Funkcije `admin-recovery-sandbox-login` i `admin-recovery-isolated-api`, verzija 2.
  Reprodukcija izvora: `scripts/recovery-edge-bundle.mjs` +
  `admin-recovery/sandbox/approved-public-config.json`. Vezivanje sadrži samo
  javni novi projectRef i odvojeni origin, nikada tajne.
- Zaštićen novi origin koji je Sites stvarno vratio:
  `https://ispovesti-admin-recovery-sandbox.borjan-saric.chatgpt.site`.
  Ovo zamjenjuje staru planiranu jovialfrog11 adresu. Site ID je i dalje
  `appgprj_6ae0790b1fc88191b233d3dddf2b8ccf`; ne praviti novi Site.
- Prvi privatni deploy uspješan. Frontend se ponovo pakuje za stvarno vraćeni
  origin; najnoviji status potvrditi native Sites alatom. Publika ostaje samo
  vlasnik, bez dodatih posjetilaca ili promjene javnog GitHub Pages sajta.
- UI ima `deploymentReady:false`, ne prikazuje funkcionalnu prijavu i jasno
  objašnjava da nalog/e-mail/CAPTCHA još čekaju podešavanje.

## Stvarno provjereno

- Objavljeni login endpoint bez tokena: 401 i lokalizovana poruka o prijavi.
- Objavljeni recovery endpoint bez aktivacije: 503; ne izdaje linkove i ne
  mijenja lozinke. Ponoviti ove provjere sa stvarnim novim originom poslije
  posljednje verzije.
- Supabase security advisors: nema prijavljenih nalaza na praznom novom projektu.
- Cijeli lokalni skup: 161/161. Izolovani recovery/builder testovi 15/15;
  test reprodukcije Edge vezivanja dodatno prošao poslije promjene origina.
- Nije testirana stvarna dostava, korisnički reset ili pravi Turnstile izazov.

## Konkretna blokada

Supabase dashboard u cloud browseru traži prijavu. Otvoren je bezbjedni obrazac
za izbor GitHub/ChatGPT/SSO/e-mail načina; poziv se završio istekom vremena,
bez potvrđenog prijavljenog stanja. Browser sesija je potom bila prazna.
Ne tumačiti ovo kao odbijanje odobrenja, ne kao uspješnu prijavu i ne kao bot
blokadu. Korisnik treba završiti prijavu kroz bezbjedni obrazac ili podržano
preuzimanje browsera. Ne tražiti lozinku/kod u običnom razgovoru i ne čitati
postojeće tajne iz browsera ili iz baze radi zaobilaženja te prijave.

## Dovršavanje poslije prijave

1. Na novom projektu podesiti Site URL/redirect na stvarni gornji origin,
   odobreni besplatni mail servis, OTP šablon sa {{ .Token }} i expiry600;
   provjeriti ograničenje javne registracije. Postojeće Auth postavke i nalog
   stvarnog sajta ostaju odvojeni.
2. Pozvati novi probni administratorski nalog na potvrđeni vlasnikov e-mail.
   Šalje se jedan poziv; ne ponavljati naslijepo. Korisnik sam unosi i potvrđuje
   novu probnu lozinku i sve kodove. Ne postavljati lozinku umjesto njega.
3. Kad postoji tačno jedan potvrđeni novi Auth UID, primijeniti već pregledani
   `admin-recovery/sandbox/prepare-isolated.sql`, sa approval i owner UID
   postavkama iz plana, isključivo u rbufvpaovofusnndvgpv. Guard namjerno odbija
   sadašnje stanje bez korisnika. Zabilježiti izvršavanje i hash, ne ponavljati.
4. Namjenski pravi Turnstile sitekey/secret i Resend sender/API ključ unose se
   kroz bezbjedne servisne postavke. Ne koristiti javne testne CAPTCHA ključeve
   kao zamjenu za stvarnu sigurnosnu provjeru. Ne kopirati stare tajne.
5. Podesiti env iz `server-settings.example.json` na novom projektu, uključujući
   tačan owner UID i novi origin, zatim provjeriti mail, jedno korišćenje i istek
   linka, reset kroz korisnički unos, odbijanje starih sesija, novi password+OTP
   pristup i odjavu. Aktivirati frontend tek poslije provjere spremnosti.
6. Ova samostalna proba prijave još nije kompletan moderatorski panel. Postojeća
   priprema svih alata/moderacije/chata je u istoj GitHub razvojnoj grani. Povezati
   je na potvrđenu Auth sesiju i stvarnu bazu, uz novu pregledanu migraciju za
   dodatne alate. Ne predstavljati lokalne ključeve ili browser storage kao trajni
   administratorski backend. Postojeća dokumentovana ograničenja analitike,
   oglasa, naplate i istorijskih snimaka profila ostaju otvorena.

Glavni sajt nije objavljen ovim radom. Nemamo opravdanje da prijavimo potpuno
završen projekat dok gore opisani povezani tok ne radi.

## Ažuriranje nakon vlasnikovih postavki, 08:34 UTC

Ovaj odjeljak zamjenjuje raniji opis praznog projekta i blokirane prijave.
Vlasnik je u svom Chrome-u podesio novi Site URL i oba redirecta, Resend SMTP
(ključ je sam unio), OTP šablon, rok600s i dužinu8, te napravio jedan potvrđeni
probni nalog sopstvenom lozinkom. MCP je potvrdio tačno1 neanonimnog potvrđenog
korisnika; e-mail, lozinka i ključ nisu čitani.

Primijenjena je `isolated_recovery_bootstrap` samo u novom projektu. UID je
izveden iz jedinog potvrđenog korisnika unutar transakcije. Dodatni service-only
RPC `recovery_sandbox_owner()` vezuje login na taj zapis, bez UID-a u javnom
izvoru ili novog ručnog podešavanja tajne. Nema ponavljanja bootstrap migracije.
Provjera: jedan owner, poklapanje s Auth korisnikom, anon/authenticated nemaju
EXECUTE na owner/login RPC. Advisors: 5 očekivanih INFO za privatne RLS tabele
bez javnih politika (namjerno deny-all); WARN za isključenu provjeru kompromitovanih
lozinki koja prema dashboardu traži Pro. Nije uključen plaćeni plan.

Login Edge je verzija3. UI ima `loginReady:true`, `deploymentReady:false`:
lozinka+OTP proba je dostupna, recovery ostaje neaktivan. Login bez tokena vraća401;
recovery503. Devet relevantnih lokalnih testova prošlo. Stvarna dostava OTP-a i
korisnička prijava tek slijede; nisu zamijenjeni lokalnim testovima.
Privatni Site commit841e51d1bc7cfd1353a8c97c9cd61eaafe63045f i deploy
appgdep_6ae4567581f481918b726b17b71f0ad4 su uspješni. Odvojena prijava nije
kompletan moderatorski panel. Preostali recovery CAPTCHA/server secrets i
povezivanje moderatorskih alata ostaju otvoreni. Ne tražiti tajne u razgovoru.

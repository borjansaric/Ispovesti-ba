# Završetak glavne administracije — 30.10.2026.

Ovaj dokument nastavlja LIVE-COMPLETION-20261030.md i zamjenjuje stare navode
da su svi pregledi analitike i reklamnih zakupa samo lokalna proba. Vlasnik
je izričito zatražio završavanje svih dostupnih dijelova bez ponovnih prekida.
Nema dodatnog troška, naplate, kupovine domene, izmjene izgleda ili brisanja.

## Završeno

- Glavni panel dobija serverom zaštićenu statistiku iz stvarnih content/votes/
  reports/chat messages tabela. Datum od/do i dan/sedmica/mjesec/godina,
  Europe/Sarajevo, broj izvršenih radnji i različitih anonimnih učesnika,
  trenutni red/published/removed i satna raspodjela chat poruka. Izvoz JSON-a.
  Statistika uključuje uklonjene zapise kao prethodnu aktivnost, bez otkrivanja
  tijela poruka ili identifikatora. Ne prikuplja nove visitor/heartbeat događaje.
  Posjete, pregledi, online i jedinstvene fizičke osobe se NE mjere i to je
  izričito napisano. Učesnik radnje nije posjetilac. Nema izmišljenih procjena.
- Evidencija zakupa po mjesecu i 34 polusatna termina 07:00–24:00 u Sarajevu.
  Cijenu u KM unosi vlasnik, čuva se tačan broj feninga. Ponovljeni zahtjev
  ima UUID; preklopljeni aktivni termin se odbija. Ručne oznake plaćeno/
  neplaćeno, otkazivanje bez brisanja, sačuvana istorija izmjena i izvoz.
  Oznaka nije bankarska/SMS potvrda ili pokretanje transakcije.
- Direktni tekstualni baner: vlasnik unosi tekst i HTTPS link bez kredencijala,
  pa posebno uključuje objavu. Samo plaćen, neotkazan i objavljen zakup u
  tekućem mjesecu/terminu se vraća javnosti. Javni odgovor sadrži samo tekst
  i link, bez cijene, imena iz interne evidencije ili identifikatora. Nema
  mrežnih embeds, tracking piksela, cookies ili automatske naplate. Preglednik
  najviše jednom u minutu provjerava vlastiti API, zaustavlja nove provjere
  dok je kartica skrivena ili chat otvoren. Prikazi nisu mjereni niti obećani.
  Nema nijednog stvarnog zakupa/oglasa i nijedna mreža nije uključena.
- Javni kontakt: odvojena contact.html stranica i polja u glavnoj administraciji.
  Samo izričito uneseni javni naziv/e-mail idu javnosti. E-mail prijave i ključevi
  se ne preuzimaju. Početno prazno. Prijava sadržaja preko ! ostaje dostupna.
- Privatnost/uslovi/lokalni podaci dopunjeni stvarnim ponašanjem, kontakt
  putanjom i pravima podataka. Zadržana oznaka nacrta; identitet operatera,
  pravni osnov, dobna pravila i rokovi nisu izmišljeni. Izvor za pripremu:
  https://azlp.ba/Gradani/default.aspx?id=4703&langTag=bs-BA&pageIndex=1&template_id=149
- Jedna dijeljena administratorska Auth instanca sprečava paralelne klijente
  za isti storage ključ. Odvojena anonimna i vlasnička sesija ostaju odvojene.

## Primjena i zaštita

complete_live_admin_operations_20261030 je uspješno primijenjena; dodaje samo
admin_operations_live i service-only RPC. community-live-api verzija3 potom
postavljena; Auth identitet i session_id dolaze isključivo iz provjerenog JWT-a.
Uspješno primijenjena complete_live_direct_banner_20261030 iz operations-banner.sql dodaje prazne creatives/creative_audit
tabele i service-only banner RPC. community-live-api je zatim postavljena kao verzija4. Početna operations.sql i druga migracija
zajedno daju završno stanje; ne ponavljati prvu na postojećoj bazi.

Sve nove tabele imaju RLS, bez anon/authenticated/PUBLIC dozvola. Admin RPC
zahtijeva postojećeg vlasnika, stvarnu Auth sesiju i važeću potvrdu e-mailom.
Javne radnje imaju samo namjerno objavljene kontakt/baner vrijednosti.
Izvorni server/SQL se ne dodaje u statički allowlist. /test/ i original.css/
styles.css ostaju identični. Stare arhive, sadržaj i lozinke ostaju.

Lokalni PostgreSQL testovi pokrivaju stvarne SQL upite, service_role dozvole,
tuđi/istekli dokaz, agregate, datumske granice, idempotentnost zakupa,
preklapanje, audit, otkazivanje i isključenu objavu. Browser QA je izolovana
fixture stranica sa sintetičkim podacima: to nije produkcijska finansijska
evidencija niti dokaz stvarnog admin Auth/e-mail toka.

## Preostale odluke, ne skriveni programski zadaci

1. Javna adresa/naziv koje vlasnik želi objaviti; polja su već dostupna.
2. Konačna politika: operater/pravni osnov/rok čuvanja/dobni uslovi. Dodatno
   mjerenje posjeta/online ostaje isključeno do odluke o načinu i privatnosti.
   Već potvrđena pravila čuvanja svih chat poruka i zabrana brisanja nisu mijenjana.
3. SMS provajder, ugovor, cijene paketa i potvrđen format potpisa/callback-a
   i dostave. Naplata se ne može završiti izmišljenim provajderom ili cijenom.
4. Stvarni oglašivač/mreža/ugovor i kreativni sadržaj. Direktni baner je
   tehnički pripremljen; ad-network integracija zavisi od izabrane mreže i pravila.
5. Vlasništvo/registracija domene. Postojeći GitHub Pages radi preko HTTPS-a.

Oporavak je uključen, ali slanje recovery e-maila i promjena lozinke ostaju
neprovjereni na izričit zahtjev vlasnika. Nisu traženi lozinka, OTP ili ključ.

## Završna provjera

Svih173 lokalnih testova prošlo. Glavni health je ready/live/CAPTCHA=true.
Stvarni SQL je potvrdio praznu reklamnu evidenciju i nijedan kreativni oglas,
nula novih tabela bez RLS, anon/authenticated banner RPC nedostupan i141
sačuvan stari zapis. Novi javni kontakt200/prazan, zaštićene operacije401 bez
prijave. Nema čitanja Resend/Turnstile tajni, pravog resetovanja lozinke,
stvarnog zakupa, uplate ili objave sintetičkog sadržaja na glavnom projektu.

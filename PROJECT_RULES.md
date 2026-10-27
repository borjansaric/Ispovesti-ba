# Konačna specifikacija Ispovesti.ba — 25.10.2026.

Odluka vlasnika izričito zamjenjuje obavezne reklame 3/2/1 i zabranu besplatnog objavljivanja. Ranija reklamna demonstracija je povučena iz plana.

Postojeći crno-zlatni izgled, Anonimus, fontovi, dugmad, animacije i raspored ostaju sačuvani. Nema redizajna. original.css i styles.css se ne mijenjaju; novi stilovi samo za nove funkcije chata.

Čitanje, objavljivanje ispovijesti, komentari i odgovori su potpuno besplatni. Nema obaveznih video reklama ni reklamnih prava. Jedan mali gornji baner ostaje neaktivan prostor dok mreža nije izabrana. CAPTCHA, spam ograničenja, zaštita duplikata, pravila moderacije, red objavljivanja, privatne liste i glasanje ostaju.

Jedna zajednička anonimna chat soba, bez privatnih poruka. Nove poruke se automatski prikazuju. Generisani nadimak i unaprijed pripremljeni avatar uključeni su u pristup. Nema korisničkih fotografija. Obavezne su prijave, lično blokiranje, moderacija i zaštita od spama. Ne obećavati apsolutnu anonimnost prema infrastrukturi i moderatorima.

| Paket | Trajanje | Pomična istorija prema serverskom vremenu |
|---|---|---|
| 24 sata | 24 sata | posljednji 1 sat |
| 7 dana | 7 dana | posljednjih 7 sati |
| 30 dana | 30 dana | posljednji 31 sat |

Server provjerava paket i istoriju pri svakoj radnji. Poslije isteka nema čitanja ni slanja. Cijene još nisu određene. Izabrani nadimak i promjena avatara su odvojene dodatne kupovine. Nadimak se rezerviše do isteka pristupa plus 15 dana; obnova u tom roku zadržava ga bez nove kupovine. Zatim ga može preuzeti drugi korisnik. Kupljeni avatar ostaje sačuvan nakon isteka.

Siguran oporavak anonimnog chat naloga koristi korisnički sačuvan nasumičan tajni ključ bez javnog stvarnog identiteta. Sirovi ključevi se ne čuvaju u bazi ni logovima. Oporavak rotira ključ i prenosi chat prava na novu anonimnu sesiju. Administratorski nalog se ne oporavlja tim putem.

Premium SMS se istražuje samo za BiH, Srbiju, Hrvatsku, Crnu Goru, Sloveniju i Sjevernu Makedoniju. Bez odobrenja nema stvarne naplate, ugovora, cijena, automatskog obnavljanja niti drugih država. Probne pakete i dodatke dodjeljuje samo provjeren administrator uz serverski testni režim; produkcija odbija testne radnje.

Prvo osvježiti privatnu rezervnu kopiju, uključujući liste, i sačuvati kod. Bez izričitog odobrenja ne primjenjivati SQL i ne objavljivati glavni sajt. Prvo prikazati kompletan SQL. Ne ponavljati izvršene migracije. Sačuvati /test/, sve podatke, administratora i ranije kopije. Novo testiranje na /test/ čeka odobrenje SQL-a. Stare probne objave arhivirati nedestruktivno i zatvoriti stare javne API puteve. Nema DELETE/TRUNCATE/DROP čišćenja.

Druga ranije potvrđena pravila se ne mijenjaju. Kod prepreke obavijestiti vlasnika bez samostalnog kompromisa. Ne tražiti ponavljanje odluka. Važi za web i Android APK. Identitet projekta i lični podaci ne šalju se dobavljačima bez posebnog odobrenja.

## Izričita dopuna vlasnika 26.10.2026.
Samo /test/: fullscreen chat sa X gore lijevo, avatar bez obruba i tekst bez nadimka; slučajna strana vlastitih poruka po paketu čuva se serverski. Istorija ide skrolovanjem, bez dugmadi za starije/nove poruke. Pravila i privatnost i lično odblokiranje su u diskretnom meniju. Moderatorske ovlasti ostaju.
Komentari i odgovori: sitni glasovi i privatno srce, broj iznad punog žutog trougla. Fokusirani original i ravno poravnati svi potomci u modalu, uz blur ostatka i povratak na istu poziciju; nula odgovora omogućava prvi odgovor.
Korisnički tajni recovery ključ povlači se samo iz interfejsa. Novi pravac je jedan SMS pristupni kod po kupovini, ponovljiv do istog isteka, bez produžavanja. Jedna aktivna chat sesija; prelazak opoziva prethodnu i ne daje Auth/admin prava. Samo administratorski testni kodovi dok nema provjerenog SMS provajdera. Postojeći recovery i podaci se ne brišu. Ovim zadatkom vlasnik odobrava usklađene testne izmjene bez pojedinačnih potvrda; nema odobrenja za glavni sajt ili stvarnu naplatu.
Ne koristiti bratov hosting/mail server niti dijeliti pristup s njim bez novog izričitog odobrenja vlasnika.

Dorada komentara 26.10.2026: srce uvijek zlatno, sitniji broj odgovora; nula je prazna oznaka uz aktivnu strelicu. Novi odgovori dozvoljeni su isključivo na glavne komentare, nikada na postojeće odgovore. Stari potomci ostaju čitljivi i sačuvani. Chat se ne mijenja.

Dogovor sljedeće dorade: žuta srca na ispovijestima i komentarima, žuti brojevi komentara/odgovora/glasova, veća nevidljiva dodirna površina i blaga animacija pri čuvanju (poštuje reduced-motion). Prvi glas smije se promijeniti najviše jednom tokom prvih 10 minuta, poslije promjene ostaje zaključan; zbir tek nakon 10 minuta. Bez čuvanja draftova komentara/odgovora. Nova SQL dopuna čeka pregled i izričito odobrenje.

Primjena odobrena i završena 26.10.2026: one-vote-change-test.sql (SHA-256 f8e140945f60dd524f6336fcbe9bad932f449ead0bb872d188b4c9b4f81ca2d8) primijenjen isključivo na community_test. change_used i trigger sprovode najviše jednu promjenu tokom 10 minuta na ispovijestima, komentarima i odgovorima. Privatna kopija votes_before_one_change_20261026 sačuvana. Prethodna napomena da ovaj SQL čeka odobrenje više ne važi. Pravila vidljivosti rezultata nepromijenjena. Glavni public podaci, administratorske ovlasti i chat nisu mijenjani.

Dorada 26.10.2026: samo /test/, uklonjeni okviri oko radnji ispovijesti; prijava svakog komentara/odgovora dostupna uzvicnikom u redu radnji. Meni u zaglavlju skroluje sa stranicom i ne prekriva tekst; fiksiran samo dok je navigacija otvorena. Glavni sajt, chat i baza nisu mijenjani.

Odobrena skica primijenjena 26.10.2026 samo na /test/: strelica/broj na glavnom komentaru prethode uzvicniku; odgovori nemaju strelicu. Prijave su mali obicni znak ! priguseno crvenkaste boje #ad7777 (12px), ukljucujuci ispovijesti. U obrascu odgovora postoje ← Nazad i Posalji kao sitna tekstualna dugmad bez okvira/pozadine; Nazad zatvara fokusirani prikaz i vraca prethodnu poziciju. Obje kontrole zakljucane tokom slanja. Chat i glavni sajt nepromijenjeni.

26.10.2026: vlasnik odobrio stalnu usku ruckicu za lijevi meni na sredini ekrana, umjesto trake pri skrolovanju. /test/ handle8: 20x54px, dodirni prostor 32px, lijevi prostor stranice najmanje32px, tekst od47px. Otvaranje menija i zatvaranje ostaju isto. Glavni sajt i chat nepromijenjeni. Izricito odobren zajednicki Pages postupak uz nepromijenjene glavne datoteke.

26.10.2026 nova odluka vlasnika zamjenjuje ruckicu: samo tri male strelice ››› gore skroz lijevo, bez okvira, obruba ili pozadine. Stalno dostupne; lijevi prostor stiti tekst. Ne dodavati okvire kontrolama bez zahtjeva. Samo /test/; chat/glavni sajt netaknuti.

Nova odluka 26.10.2026 zamjenjuje fokusirani prozor: odgovori se sire direktno ispod glavnog komentara, bez modala i bez zamagljivanja ostatka. Ponovni klik na istu strelicu ili Nazad zatvara odgovore. Odgovori ravno poravnati, bez odgovaranja na odgovor. Samo /test/.

26.10.2026 dopuna: odgovori ostaju inline, ali se vraca zamagljivanje ostatka stranice oko aktivnog glavnog komentara. Samo jedna aktivna grana. Ucitavanje progresivno, odmah po pristizanju stranice; nezavisne stare podgrane najvise3 istovremeno; bez kesiranja javnog sadrzaja radi moderacije; zatvaranje zaustavlja naredne zahtjeve. Bez promjena baze/serverskih pravila/chata.


Završna priprema 26.10.2026: aktuelnu objedinjenu specifikaciju predstavlja docs/CURRENT-SPEC-20261026.md; novije odluke u njoj i ovoj istoriji imaju prednost nad ranijim opisima modala, recovery UI-ja i ručkice. Jedan neaktivan sticky probni baner, bez mreže i bez prekrivanja sadržaja; chat bez reklama. Dodatni pojedinačni nadimak uz dobrovoljnu reklamu ostaje buduća mogućnost po sadržaju, odvojeno od plaćenog chat nadimka; ne aktivirati bez odluke vlasnika i provjere mreže. Produkcija ne smije uključiti testni chat API, generatore kodova ili probna prava. Za prelazak koristiti docs/SAFE-CUTOVER-20261026.md i cijeli launch/SQL-REVIEW-20261026.md. Bez odobrenja ne izvršavati SQL, arhiviranje, glavni deploy ili naplatu. Razvojna grana nije odobrenje za zajednički Pages deployment.


27.10.2026: vlasnik traži „Zaboravljena lozinka?“ za postojeću administratorsku lozinku, prvo /test/. Jednokratni e-mail link ograničenog trajanja, zaštita zloupotrebe, opoziv starih sesija i obavezna nova prijava lozinkom + dodatnim e-mail kodom. Nikada tražiti lozinku ili kod u chatu. Priprema admin-recovery je neaktivna do pregleda novog SQL-a i odobrenog testnog postavljanja. /test/ dijeli postojeći Auth nalog, pa stvarna promjena njegove lozinke zahtijeva zasebno izolovan Auth projekat ili posebno odobrenje za uticaj na zajednički nalog. Ne zaobilaziti ograničenje nazivom testne šeme. Glavni recovery UI nije odobren. Detalji: docs/ADMIN-RECOVERY-20261027.md.

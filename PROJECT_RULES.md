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

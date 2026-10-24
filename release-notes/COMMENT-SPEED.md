# Brži prikaz komentara i odgovora

Problem: poslije uspješnog slanja komentara frontend je čekao ponovno učitavanje cijele liste i zaseban zahtjev za broj komentara. Slanje odgovora nije odmah osvježavalo već otvorenu granu.

Promjena samo u testnom okruženju:
- Testni SQL dispatcher vraća potvrđeni komentar/odgovor (eksplicitno izabrana javna polja) i korisnikov kontekst u istom odgovoru kao čuvanje. Ispovijesti i dalje dobijaju samo potvrdu reda čekanja.
- Frontend odmah nakon potvrde upisuje taj element, bez ponovnog učitavanja prethodnih komentara. Novi odgovor otvara svoju granu. Prilikom paginacije već prikazani element se ne duplira; server i dalje vraća najstarijih 20 po stranici.
- CAPTCHA skripta može se pripremiti pri fokusiranju teksta; widget i novi token pokreću se tek prilikom slanja. Sigurnosna podešavanja se i dalje svježe čitaju na slanju. Serverska Siteverify provjera ostaje obavezna.
- Tokom čekanja jasno piše „Šaljem…“. Tekst ostaje u formi ako serverska ili CAPTCHA provjera odbije slanje.

Provjera: 55 automatskih testova prolazi, uključujući nove provjere sadržaja potvrde, vremena iz baze, ugnježđavanja, privatnog konteksta, odsustva identiteta/rezultata glasanja i očuvanja reda čekanja ispovijesti. JavaScript sintaksa provjerena. Pozitivan test brzine na korisnikovom telefonu čeka ponovno učitavanje testne stranice; nema obećanja tačnog vremena, jer mreža i Cloudflare provjera i dalje utiču na slanje.

Sačuvana prethodna verzija: backup/before-comment-speed-20261024. SQL migracija mijenja samo public.community_test_dispatch za community_test podatke. Ne mijenja postojeće redove, tabele ni privilegije; zadržava serversku provjeru administratorske e-mail sesije. Glavni index.html i legacy funkcije ostaju netaknuti.

# Ispovesti.ba — pregled produkcijske pripreme release12

Aktuelni status 26.10.2026: pripremljeno i lokalno testirano, **nije primijenjeno na produkciju**. Osnovni sajt je besplatan. Posljednji javni /test/ je progressive11; nova release12 dorada nije objavljena. Testni chat ostaje nepromijenjen, produkcijski chat i naplata isključeni.

Počni od [objedinjenog izvještaja](../docs/final-readiness-20261026.md), [konačne specifikacije](../docs/CURRENT-SPEC-20261026.md) i [redoslijeda prelaska](../docs/SAFE-CUTOVER-20261026.md). Starije READINESS bilješke su istorijske i ne predstavljaju stanje odobrenja.

[Cijeli SQL za pregled](SQL-REVIEW-20261026.md) sadrži tri odvojene skripte. Ne izvršavati zajedno niti bez posebnog odobrenja:

1. prepare-live.sql: atomski stvara novu praznu community_live šemu i servisne RPC funkcije; odbija ponavljanje. Kopira samo postojeći vlasnički UID i šifrovana podešavanja zaštite. Ne mijenja stare objave, komentare, glasove, privatne liste, Auth lozinke ili rezervne kopije. Publisher je pauziran.
2. activate-publisher.sql: odvojeno odobreno aktiviranje rasporeda najviše jedne ispovijesti na sat.
3. archive-legacy-after-cutover.sql: tek poslije potvrđenog novog API-ja i stvarne admin prijave; čuva stare redove, oduzima pristup legacy tabelama. Bez DROP/TRUNCATE/DELETE čišćenja.

community-live-api.ts je budući zasebni endpoint. Auth provjerava na serveru, administracija zahtijeva postojeću sigurnu prijavu i novi email dokaz. scripts/check-live-ready.mjs provjerava live/free, CAPTCHA, odvajanje i capabilities za jednu promjenu glasa, root-comment odgovore i live metadata. Stvarne provjere tog endpointa čekaju postavljanje uz odobrenje.

Build: node scripts/build-production-review.mjs. Objavljuje se samo dozvoljeni statički izlaz .production-review, ne cijeli repozitorijum. /test/ se čuva zasebno; glavni chat ne smije uvoziti testne kodove/sesije. SITE_ORIGIN promijeniti tek nakon provjere domene. Radna grana nema automatski glavni deploy.

Lokalni skup:127/127. Svježa privatna kopija aplikacijskih podataka:32 tabele/251 red, potvrđeno vraćanje tipiziranih redova. To nije puna Auth/PITR kopija. Starije kopije i postojeći administrator sačuvani. Vidi izvještaj za otvorenu vizuelnu provjeru, pravni pregled i granice sigurnosnih potvrda.

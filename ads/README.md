# Reklame — razvojna priprema, ništa nije objavljeno

Mjerodavna specifikacija: [PROJECT_RULES.md](../PROJECT_RULES.md). Raniji opcionalni saldo i besplatno slanje u ovoj razvojnoj pripremi su uklonjeni; raniji prijedlog nije odobreno poslovno pravilo.

## Implementirana demonstracija

- Mali normalno pozicioniran probni baner 320 × 50 gore desno i zasebno dugme +; bez prekrivanja teksta i nagrada za klik na baner.
- 3 završena gledanja za jednu ispovijest, 2 za odgovor, 1 za komentar. Prije svakog gledanja prikazuju se radnja, cijela kvota i napredak. Nema besplatnog slanja ni kasnijeg oslobađanja od reklama.
- Jedna simulacija traje pet sekundi vidljivog vremena. Prekid i skriveni tab ne daju lažni napredak. Vrste su odvojene, događaji jedinstveni, saldi rezervisani protiv dvostrukog trošenja. Potpuna kvota se troši tek nakon uspješnog upisa; neuspjeh ili odbijen duplikat je čuvaju.
- `ads-preview.html` koristi zasebne lokalne probne podatke; CSP zabranjuje vanjske veze. Probni saldo je samo u memoriji i resetuje se osvježavanjem; to ograničenje demonstracije nije pravilo o isteku stvarnih prava.
- Samo `mode: preview` uz `ads.enabled: true, provider: mock` aktivira demonstraciju. Neaktivni modul u neobjavljenom kandidatu ne predstavlja implementaciju stvarnog serverskog zaključavanja. Produkcija i /test/ nisu promijenjeni. Stvarne mreže, dozvole, SDK-ovi i migracije nisu povezani.

## Prepreka: Google rewarded

Provjereno 24.10.2026: [zvanična Google pravila](https://support.google.com/admob/answer/7313578?hl=en), Implementation requirements 2, zahtijevaju da preskakanje ili odbijanje reklame ne ometa normalno korištenje platforme. Dozvoljavaju jasno objašnjene grupe više reklama za jednu nagradu, ali to nije potvrda da je obavezno gledanje za svaku osnovnu objavu dozvoljeno. Zato Ad Manager za web i AdMob za Android nisu potvrđeno usklađeni s našim modelom. Njihovo povezivanje je ZAUSTAVLJENO. Pravila vlasnika ostaju 3/2/1; nema samostalnog kompromisa ili besplatnog toka.

## Alternativa za odluku vlasnika — nije povezana

Direktno ugovorene sponzorske video-reklame za vlastiti web player i budući Android player, bez Google rewarded inventara. Ugovor sa sponzorom i dobavljačem videa mora izričito dozvoljavati nagrađeno gledanje za obavezno otključavanje sadržaja po modelu 3/2/1. To je drugačiji način nabavke oglasa koji može sačuvati poslovna pravila; nije tvrdnja da već imamo dozvolu mreže ili pravno odobren ugovor. Nisu traženi sponzori, slane poruke, otvarani računi ili prihvaćeni ugovori.

Prije implementacije vlasnik bira tu opciju ili zahtjev za izričitu pisanu saglasnost druge mreže za tačno ovaj model. Treba potvrditi prava na video, privatnost, način mjerenja i zaštitu od lažnih pregleda. Web player/tajmer sam po sebi nije siguran dokaz gledanja: potreban je provjeren serverski protokol; ne obećavati potpunu zaštitu od automatizacije. Kod nedostatka oglasa nema automatskog besplatnog slanja. Način rješavanja dostupnosti oglasa zahtijeva odluku vlasnika prije stvarne integracije.

Nijedna alternativa nije automatski izabrana ili aktivirana. Po odluci vlasnika slijede lokalni server testovi, provjera uslova i zasebno odobrenje za bazu i objavljivanje.

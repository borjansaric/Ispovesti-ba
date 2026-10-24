# Probne reklame — priprema, bez objavljivanja

Status: samo odvojena razvojna grana. Nema novih reklamnih naloga, naplate, pravih oglasa, slanja podataka mrežama ni izmjena baze. Produkcija, postojeći podaci i `/test/` nisu mijenjani. Priprema se ne spaja u već odobrenu produkcijsku verziju bez novog odobrenja.

## Prikaz i probni tok

- `ads-preview.html` je pregled bez Supabase veze. Koristi zasebne probne podatke u pregledniku, a CSP zabranjuje vanjske mrežne zahtjeve.
- Mali pravougaoni prostor 320 × 50 je gore desno, s jasnom oznakom. Na uskom ekranu zauzima svoj red ispod menija. Ne pluta preko priča, nema zvuk, automatski video ili nagradu za klik na baner.
- Zasebno dugme `+` otvara izbor: ispovijest, komentar ili odgovor. Prije svakog gledanja navode se radnja i probna nagrada. Reklama počinje tek pritiskom na odgovarajuće dugme.
- Simulacija traje pet sekundi vidljivog vremena, može se prekinuti i pauzira se u skrivenom tabu. Završetak dodaje jedno probno otključavanje samo izabranoj vrsti; dupli događaj ne dodaje drugo.
- Otključavanje je opcionalno pri slanju. Slanje bez njega ostaje dostupno. Rezervacija sprečava trošenje jednog salda u dva istovremena slanja. Saldo se troši tek kada server/preview API potvrdi upis; greška ili upozorenje o duplom tekstu ga vraćaju. Ispovijest se i dalje čuva u redu, bez preskakanja CAPTCHA, validacije, moderacije i ograničenja protiv spama.
- Probni saldo je samo u memoriji stranice i nestaje osvježavanjem. To nisu stvarne serverske dozvole, reklamni pregledi ili prihod. Jedna reklama po probnom otključavanju služi demonstraciji, nije odluka o konačnim kvotama. Raniji planovi kvota nisu aktivirani niti zamijenjeni ovim primjerom.
- Simulacija se uključuje isključivo kroz `mode: preview` i izričit `ads.enabled: true, provider: mock`. U režimima `live` i `live-test` ostaje isključena. Stvarni provajder je namjerno nedostupan dok ne postoji potvrđena integracija.

Usput je u novoj razvojnoj kopiji ispravljen postojeći kandidat obrasca za prijavu sadržaja, koji je koristio promjenljive iz obrasca za objavljivanje. Dodat je regresioni test. Objavljeni kod i `/test/` nisu prepravljani.

## Preporučeno rješenje za web

Google Ad Manager + Google Publisher Tag za odvojeni display baner i pravi rewarded format. GPT daje događaje spremnosti, dodjele i zatvaranja; nagrada se veže za događaj dodjele, ne za zatvaranje. Format se traži samo gdje je podržan; prazan odgovor ili nepodržan uređaj ne zaključavaju besplatni tok. Dostupnost formata, naloga i potražnje mora se potvrditi na stvarnom odobrenom nalogu. Ne obećava se prikaz niti zarada.

Dokumentovani GPT događaj iz preglednika sam po sebi nije dokaz za naš server. Prije stvarnog zaključavanja dodatne kvote potrebno je ugovoriti/potvrditi način vjerodostojne serverske potvrde za izabrani web proizvod. Dokumentacija za AdMob SSV nije automatski specifikacija web GPT potvrde. Priprema zato ne pretvara browser događaj u stvarnu dozvolu.

## Preporučeno rješenje za Android APK

Za stvarni Android sloj: AdMob rewarded format kroz Google Mobile Ads SDK i verifikacija SSV potpisa na serveru. Nagrada se čuva nakon provjerenog callbacka; klijentski `OnUserEarnedRewardListener` može pokazati da se čeka potvrda. Koristiti zvanične testne jedinice tokom razvoja.

Važna granica za plan bez Play prodavnice: direktno dijeljeni APK bez podržane prodavnice ne može dobiti punu AdMob provjeru i ima ograničen prikaz oglasa. Google Play nije jedina opcija: među podržanima su Samsung Galaxy Store i druge navedene u izvoru. Bez odluke o distribuciji ne obećavati normalnu monetizaciju. Običan APK omotač ne daje automatski pravo na AdMob; za web oglase unutar WebView-a posebno provjeriti WebView API for Ads integraciju.

## Pravila koja utiču na naš dizajn

Korisnik prije svake reklame vidi šta dobija i koliko gledanja treba. Potreban je jasan izbor, mogućnost odustajanja i normalan tok bez reklame. Ne nagrađujemo klik, instalaciju ili kupovinu. Nagrada ostaje neprenosivo pravo unutar platforme, bez novca ili kripta. Ne koristiti molbe da se reklama gleda radi podrške vlasniku. Model obaveznih oglasa za svako osnovno pisanje zahtijeva provjeru s mrežom; nije proglašen dozvoljenim.

Baner se odvaja od menija i dugmadi da ne izaziva slučajne klikove. Kod anonimnih ispovijesti mora postojati moderacija: seksualni, šokantni ili drugi ograničeni sadržaji mogu ostati bez oglasa ili imati manju potražnju. Ne slati tekst priče, e-mail ili administrativne podatke kao reklamni targeting. Prije pravih SDK-ova urediti obavještenje o privatnosti i odgovarajuće izbore saglasnosti; Android ima UMP za taj tok.

## Izvori provjereni 24.10.2026.

- [Google — pravila nagrađenih oglasa](https://support.google.com/admob/answer/7313578?hl=en)
- [Google Ad Manager — rewarded na webu](https://support.google.com/admanager/answer/9116812?hl=en)
- [GPT — zvanični rewarded primjer](https://developers.google.com/publisher-tag/samples/display-rewarded-ad)
- [Android rewarded SDK](https://developers.google.com/admob/android/rewarded)
- [AdMob — serverska SSV provjera](https://developers.google.com/admob/android/ssv)
- [AdMob — podržane prodavnice i direktni APK](https://support.google.com/admob/answer/9989980)
- [Pravila odvajanja oglasa i navigacije](https://support.google.com/adsense/answer/1346295?hl=en)
- [Ograničenja sadržaja](https://support.google.com/admanager/answer/10437795?hl=en-0)
- [Privatnost i Android UMP](https://developers.google.com/admob/android/privacy)
- [WebView integracija](https://developers.google.com/admob/android/browser/webview)

## Kasnija primjena

Prvo potvrditi kvote, stvarni dodatni benefit, odobrenu mrežu i distribuciju APK-a. Zatim implementirati i testirati serverski protokol iz `server-contract.md`, s isključenom zastavicom dok ne prođe provjere. Tek nakon odobrenja vlasnika povezati pravi nalog, jedinice, saglasnosti i objavljivanje. Ovaj zadatak ništa od toga ne aktivira.

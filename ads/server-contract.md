# Protokol za stvarne nagrade — nije implementiran niti primijenjen

Browser `DemoRewards` je samo demonstracija. Ne koristiti njegove salde, lokalni storage, petosekundni tajmer ili klijentski `completed` kao izvor serverskih dozvola.

Budući serverski tok:

1. Autentifikovan anonimni korisnik traži `reward_begin(kind)`. Server iz dozvoljene konfiguracije bira mrežu, jedinicu, nagradu i kvotu. Generiše jednokratan nonce, rok i vezu sa svojim Auth UID-om. Klijent ne bira proizvoljan iznos ili korisnika. Nema teksta ispovijesti u reklamnim parametrima.
2. Provajder prikazuje oglas tek nakon izričitog izbora korisnika. Zatvaranje, no-fill, greška i nepodržan uređaj ne daju nagradu niti blokiraju besplatan tok. Klijentski događaj može samo pokrenuti provjeru statusa.
3. Server prima potvrdu mreže. Za AdMob se provjerava ECDSA potpis nad tačno propisanim izvornim parametrima, prema zvaničnoj specifikaciji. Javne ključeve preuzima samo s propisanog Google endpointa, uz cache i timeout. Provjeravaju se vrijeme, dozvoljena jedinica, vrsta/iznos nagrade, vezani nonce i korisnik. Za web proizvod prvo mora biti potvrđena odgovarajuća provajderova serverska specifikacija; ne izmišljati vlastiti Google potpis niti prihvatati browser boolean.
4. Unutar jedne transakcije zapisuje se jedinstveni `(provider, transaction_id)` i jednom dodaje neprenosivo pravo samo tom UID-u i vrsti sadržaja. Dupli callback vraća isti rezultat. Nepoznate, istekle ili neispravne potvrde se odbijaju. Limiti i nadzor štite endpoint od spama.
5. `submit` prihvata samo ID odobrene dozvole. Server provjerava vlasnika, vrstu, rok, neiskorištenost i originalni idempotency ključ. CAPTCHA i postojeća validacija ostaju obavezne. Upis sadržaja i trošenje dozvole završavaju u istoj transakciji; na grešku se oba poništavaju. Ponovljeno slanje ne troši ponovo. Ispovijest se računa kao poslata nakon čuvanja u redu, ne kao odmah javno objavljena.
6. Serverska zastavica može ugasiti nagrađene oglase bez izmjene svih obrazaca. Isključivanje ne kvari već sačuvane podatke ni normalne funkcije.

Prije stvarnog rada potrebni su RLS/ACL, migracija, kriptografski testovi provajdera, testovi konkurentnosti i oporavka te ažurirana privatna kopija. Za ovaj zadatak nisu stvarane niti mijenjane tabele, RPC funkcije, Edge Functions, reklamni računi, ključevi ili dozvole.

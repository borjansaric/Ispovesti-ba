# Provjera ispravke reklamnih pravila — 24.10.2026.

- 85 lokalnih automatskih testova prolazi, bez Supabase veze. Prethodna 81 provjera ostaje u paketu; očekivanja salda usklađena su s izričito odobrenom kvotom.
- Testirane su tačne kvote 3/2/1, odbijanje nepotpune kvote, odvojenost vrsta, rezervacija, otpuštanje pri grešci, jedinstvenost reklamnog događaja i upisa te trošenje pune kvote samo nakon uspjeha.
- Sva tri stvarna obrasca, izvršena u lokalnom testnom okruženju, čuvaju kvotu na grešku, troše pri uspjehu i odbijaju novi zahtjev prije API poziva kad nema kvote. Tekst ostaje sačuvan u obrascu.
- Dvadeset uzastopnih objava ne uključuje besplatni režim. Nema opcionalnog checkboxa ili rezervne putanje za besplatno slanje u reklamnoj demonstraciji.
- Testovi prekida, skrivenog taba, paralelnog gledanja, prijave sadržaja i izolacije pregleda ostaju uspješni.
- CSS, raspored, baner i mobilni okvir nisu mijenjani ovom ispravkom. Ranija mobilna vizuelna provjera odnosila se na taj nepromijenjeni raspored; novi tekst i tok nisu ponovo ručno provjeravani u mobilnom pregledniku.
- Ostali testovi obuhvataju lokalnu bazu, red objavljivanja, CAPTCHA/server sigurnost postojećeg kandidata, moderaciju, glasanje i privatnost. Ne predstavljaju test nove stvarne reklamne integracije.
- Stvarna mreža i serverski saldo nisu implementirani niti testirani. Integracija je blokirana do odluke o usklađenom dobavljaču; browser demonstracija nije produkcijska zaštita.
- Izmijenjeni su samo ads/rewards.js, ads/ui.js, tests/ads.test.mjs i reklamna/projektna dokumentacija. Produkcijska baza, postojeći podaci, /test/, main i produkcijski PR nisu mijenjani.

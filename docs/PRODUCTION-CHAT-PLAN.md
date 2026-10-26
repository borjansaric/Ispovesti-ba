# Odvojeni produkcijski chat — plan, ne aktivna usluga

Prvo javno objavljivanje osnovnog sajta ne aktivira naplatu niti chat_test kodove. Produkcijski paket nema chat-test-api, trialCode generator ni administratorsko dodjeljivanje testnih prava. Dugme za chat otvara jasnu zatvorenu najavu. Testni chat ostaje nepromijenjen.

Prije aktivacije napraviti zasebni chat_live, chat-live-api i sesijski prostor, uz isti provjereni Auth postupak. Nijedan testni paket, kod, poruka, profil, privatni blok ili moderatorski dokaz ne prebacuje se automatski. Serverske operacije uvijek koriste potvrđeni Auth UID/session_id, nikada korisnički p_uid/_aal. Testne grane i admin_grant u produkcijskom gatewayu moraju biti nedostupne čak i administratoru; buduća ručna komercijalna podrška zahtijeva zasebnu odobrenu proceduru.

## Neizmijenjena specifikacija

- Jedna zajednička anonimna soba, bez privatnih poruka i bez reklama.
- 24 sata pristupa = pomična istorija 1 sat; 7 dana = 7 sati; 30 dana = 31 sat. Server provjerava pristup i granice istorije na svakoj stranici i pri slanju.
- Avatar i tekst bez javnog nadimka u porukama; vlastita strana nasumična po paketu, stabilna do isteka; ostali nasuprot. Unaprijed pripremljeni avatari, bez korisničkih fotografija.
- Generisani nadimak i avatar uključeni; izabrani nadimak i avatar zasebne dodatne kupovine. Nadimak rezervisan do isteka plus15 dana, obnova u tom roku zadržava ga bez nove kupovine. Izabrani avatar ostaje uz interni nalog. Nadimci se ne prikazuju u porukama prema novijoj odluci; budući ekran kupovine mora jasno objasniti gdje su vidljivi, bez samostalnog vraćanja nadimaka u poruke.
- Jedan SMS pristupni kod po kupljenom paketu; čuvati samo kriptografski sažetak. Isti kod može povratiti pristup do originalnog isteka, nikada ga produžiti. Jedna aktivna sesija, rotacija pri prelasku i serverska ograničenja pokušaja/dijeljenja. Ne daje administratorske privilegije.
- Lično blokiranje skriva poruke samo korisniku; moderatorska zabrana odbija čitanje i slanje. Prijave, pregled, uklanjanje/vraćanje i zabrane sa audit tragom. Ne obećavati end-to-end šifrovanje.

## SMS komercijalni dio za kasnije

Samo BiH, Srbija, Hrvatska, Crna Gora, Slovenija i Sjeverna Makedonija. Izbor provajdera, operatori, cijene, provizije i isplate zavise od pisanog ugovora; ništa nije aktivirano. Bez automatske pretplate/obnove. Potreban potpisani ili mTLS callback, provjera tržišta i proizvoda na serveru, jedinstven provider_purchase_id i transakcijska idempotentnost, provjera naplate prije izdavanja, privatna SMS dostava, sprečavanje ponovne aktivacije i podrška za neuspjelu dostavu/povrat. SMS od korisnika ili browser payload nisu dokaz plaćanja.

Prije lansiranja: cijene, ugovor/provajder, sandbox callback provjere, test duplog/krivotvorenog callbacka, test isteka, istorije i preuzimanja sesije sa stvarnim Auth tokenima, politika čuvanja poruka, postupak prijava, pravni pregled plaćanja i potrošačkih prava. Potreban zaseban pregled punog SQL-a i posebno odobrenje produkcijske primjene.

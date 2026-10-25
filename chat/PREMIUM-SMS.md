# Premium SMS — preliminarna provjera šest tržišta, 25.10.2026.

Status: istraživanje, bez ugovora, upita dobavljačima ili stvarne naplate. Cijene proizvoda nisu određene. Nema automatskih pretplata ni automatske obnove.

## Kandidat: NTH Mobile

Njihova zvanična ponuda navodi Premium SMS, jednokratne kupovine i HTTP API. To je dokaz tehničke ponude, a ne potvrda da je naš konkretan projekat prihvaćen. Liste operatera na stranicama tržišta nisu ugovorna potvrda da svaki operater podržava svaki model i cjenovni razred. Potrebna je pisana matrica za jednokratne kupovine pristupa, nadimaka i avatara i isplatu pravnom licu iz BiH.

| Tržište | Operateri navedeni u pregledu tržišta | Objavljeni oblik / bitna ograničenja | Zvanični izvor |
|---|---|---|---|
| BiH | BH Telecom, m:tel, HT Eronet | MO i MT; navedeni jednokratna naplata i chat. MO posebno naveden za BH Telecom i HT Eronet. Objavljene granice MO do 3,51 KM i MT do 10 KM po SMS-u treba ponovo potvrditi za ugovor i tarifnu grupu. | https://www.nth-mobile.com/conditions/bosnia-and-herzegovina/ |
| Srbija | Telekom Srbija, Yettel, A1 | MT; navedeni jednokratna naplata i chat. Ne preuzimati ponuđene primjere ponavljajuće sedmične naplate. | https://www.nth-mobile.com/conditions/serbia/ |
| Hrvatska | Hrvatski Telekom, A1 Hrvatska, Telemach Hrvatska | MO/MT; jednokratna naplata i chat. NTH navodi hrvatski jezik oglasa, kontrolu uzrasta i dvostruku potvrdu za jednokratne usluge iznad 1 EUR. | https://www.nth-mobile.com/conditions/croatia/ |
| Crna Gora | Crnogorski Telekom, One, m:tel | MO naveden za jednokratnu naplatu i chat; MT u pregledu vezan uz pretplatnički model. Tražiti jednokratni MO tok i potvrdu po operateru. | https://www.nth-mobile.com/conditions/montenegro/ |
| Slovenija | Telekom Slovenije, A1, Telemach, T-2 | MT; jednokratna naplata postoji. NTH navodi dvostruku potvrdu pri prvom korišćenju jednokratne usluge, preporučeno do 5 EUR; veći iznosi traže posebno odobrenje operatera. | https://www.nth-mobile.com/conditions/slovenia/ |
| Sjeverna Makedonija | Makedonski Telekom, A1 | MO/MT; jednokratna naplata i chat navedeni. Potrebna potvrda prihvatljivosti svakog proizvoda i tarife. | https://www.nth-mobile.com/conditions/macedonia/ |

MO znači naplatu pri slanju poruke, MT pri primanju naplatne poruke. To nisu cijene našeg paketa niti iznos koji ćemo dobiti. Ne uključivati nijednu drugu državu.

## Provizije i uslovi isplate

NTH na pregledanim javnim stranicama ne objavljuje tačnu ugovornu podjelu prihoda, fiksnu cijenu broja/ključne riječi, rokove, minimalni prag ili uslove isplate našem poslovnom subjektu u BiH. Ti podaci nisu potvrđeni za nijedno od šest tržišta. Ne navoditi procijenjenih 30/50/70% kao činjenicu.

Zvanični posebni uslovi m:tela od 25.01.2026. izričito ostavljaju podjelu prihoda ugovoru; inicijalna SMS poruka pripada m:telu i ne ulazi u podjelu. To je razlog da se odvojeno traži bruto korisnička cijena, porezi, operaterski dio, agregatorski dio, početni/mjesečni trošak i neto isplata.

Izvor m:tel: https://mtel.ba/Binary/3626/Posebni-uslovi-pruzanja-SMSMMS-usluge-sa-dodatnom-vrijednoscu-VAS-SMSMMS-usluge-25.01.2026.-godine-.pdf

## Tehnička priprema prije ugovora

- Isključivo ONETIME tok, bez SUBSCRIPTION, ABO, redovnih MT poruka ili skrivenog obnavljanja.
- Server pravi jednokratnu narudžbu za tačan proizvod i anonimni nalog. Korisnik jasno vidi konačnu cijenu, trajanje, potvrde i uputstvo operatera prije slanja.
- Pravo se dodjeljuje samo nakon provjerenog konačnog obavještenja pružaoca; screenshot SMS-a i browser povratna adresa nisu dokaz naplate.
- Potrebni su dokumentovani potpis/potvrda webhooka, zaštita od ponavljanja i duplog dodjeljivanja, vezivanje narudžbe, iznosa, valute i zemlje, te postupak otkaza/povrata i neuspjele naplate.
- Broj telefona ne prikazuje se javno niti se koristi kao nadimak. Operater/agregator će obrađivati podatke naplate; ne obećavati anonimnost prema njima. Odvojiti finansijske evidencije od javnih poruka.
- Chat schema u ovoj pripremi ima samo administratorske probne grantove. Nema aktivnog SMS broja, izmišljene tarife ili nezavršenog javnog payment endpointa.

Zvanična ponuda: https://www.nth-mobile.com/premium-sms/

API: https://developers.nth-mobile.com/premium-sms/

Razlika jednokratnog i ponavljajućeg toka: https://developers.nth-mobile.com/payment-widget/

## Šta treba tražiti u ponudi, nakon vlasnikovog odobrenja upita

Potvrdu jednokratnog anonimnog društvenog chata, sva tri paketa i dvije odvojene dodatne kupovine; tačne operatere i tarife za svih šest država; ukupnu proviziju i sve fiksne troškove; valutu, rok, prag i bankarsku isplatu u BiH; potrebnu registraciju pravnog lica i licence; obavezne tekstove i jezik; provjeru uzrasta, korisničku podršku i reklamacije; potvrdu da nema pretplate; autentifikaciju i konačna stanja API-ja; sandbox i probne SIM kartice.

Preporuka: zatražiti takvu jednu uporedivu ponudu od NTH Mobile prije izbora cijena i integracije. Ne zaključivati ugovor niti slati podatke projekta bez dodatnog odobrenja. Infobipova opšta SMS/A2P ponuda sama po sebi nije potvrda Premium SMS naplate našeg sadržaja.

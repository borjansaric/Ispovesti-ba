# Dnevni izbor — 17.11.2026.

## Pravilo prikaza

- Na stranici postoje dva susjedna taba: **Ispovest dana** i **Komentar dana**.
- Svaki tab prikazuje najviše sedam posljednjih dnevnih pobjednika — po jednog pobjednika za svaki dan koji ima objavljen odgovarajući sadržaj.
- Pobjednik dana je sadržaj s najvećim **trenutnim ukupnim brojem pozitivnih lajkova**. Broj se ne resetuje na početku dana.
- Rangiranje se računa ponovo iz trenutnog stanja glasova pri svakom zahtjevu. Ako se broj lajkova promijeni danima kasnije, pobjednik za taj datum može se promijeniti.
- Dani se određuju prema vremenskoj zoni Europe/Sarajevo.
- Ispovijesti se grupišu po vremenu objavljivanja; glavni komentari po vremenu nastanka. Odgovori na komentare nisu dio rubrike „Komentar dana”.
- Ako je broj lajkova izjednačen, prednost ima ranije objavljen sadržaj, a zatim niži ID radi stabilnog rezultata.
- Javni prikaz ne otkriva zbir glasova; zadržava se postojeće pravilo privatnosti glasanja.
- Dok je dnevni tab otvoren, prikaz se osvježava jednom u 60 sekundi i pri povratku na stranicu.

## Izolacija

- Frontend promjene su ograničene na `/test/`.
- Serverska funkcija je ograničena na `community_test` i `community-test-api`.
- Glavni `community_live`, `community-live-api`, glavni `index.html` i glavni `app.js` nisu mijenjani.
- SQL migracija: `20261117153719_daily_highlights_test`.
- Git grana: `work/daily-highlights-20261117`.
- Nema objave na GitHub Pages niti spajanja u `main` ovim korakom.

# Ispovesti.ba — priprema produkcije

Ova grana je radna priprema. Nije objavljena i nije spojena u `main`.

## Sigurne granice
- Preview ostaje na svom zasebnom preview repozitoriju i snapshot grani.
- Test sadržaj se ne kopira u produkciju.
- Ne mijenjati produkcijski `main`, domen, DNS, deploy ni live bazu bez posebne potvrde.
- Produkcijski `config.js` mora ostati `mode: "live"` i `chatEnvironment: "live"`.
- Produkcijski API pozivi moraju ostati na `community-live-api` i `chat-live-api`.
- CAPTCHA i live zaštite se ne uklanjaju niti zaobilaze.

## Provjereno 24.11.2026.
- Supabase projekat `Ispovesti-ba` je aktivan.
- Test i live koriste odvojene šeme: `community_test/chat_test` i `community_live/chat_live`.
- Test šeme imaju probni sadržaj; `community_live.content` i `chat_live.messages` su bili prazni pri provjeri.
- Produkcijski repo je stariji od zaključanog previewa u dijelu UI-ja i chat prijava.
- Preview `app.js` i `api.js` imaju promjene povezane s CAPTCHA inicijalizacijom, auth klijentom, cacheom i pending submission sistemom. Ne kopirati ih naslijepo u live granu.

## Sljedeći koraci
1. Prenijeti i pregledati UI dorade iz zaključanog previewa, uz očuvanje live API-ja i CAPTCHA toka.
2. Uskladiti chat meni/prijave i potvrditi kompatibilnost s live chat funkcijom.
3. Provjeriti stranice, bannere, pravila/privatnost, PWA manifest i APK pripremu.
4. Uraditi statičku provjeru i testiranje na privremenom preview URL-u, bez live podataka.
5. Tek nakon zasebne potvrde: objava, domen/DNS i HTTPS.

## Status
- [x] Odvojena produkcijska pripremna grana kreirana.
- [x] Pregled konfiguracije i razdvajanja test/live API-ja.
- [ ] Prenos UI dorada — u toku.
- [ ] Testiranje i završna provjera — nije urađeno.
- [ ] Produkcijska objava — nije odobrena/urađena.

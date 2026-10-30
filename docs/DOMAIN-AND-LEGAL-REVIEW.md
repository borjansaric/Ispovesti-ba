# Domena, HTTPS, pravni pregled i mjerenje

## Domena

Nije potvrđena kupovina/vlasništvo domene Ispovesti.ba. Nije mijenjan DNS, CNAME, GitHub Pages ili HTTPS postavke. Pripremljeni builder podrazumijeva postojeći GitHub Pages URL; SITE_ORIGIN se mijenja tek kada je vlasništvo potvrđeno. Ne postavljati canonical/og:url na tuđu ili nepotvrđenu domenu.

Prije domene: provjeriti vlasništvo u korisnikovom nalogu, dodati GitHub provjerni TXT prema stvarno dobijenoj vrijednosti, zatim pojedinačnom repozitorijumu dodijeliti domenu i podesiti apex/www DNS prema tadašnjim zvaničnim uputstvima. Ne koristiti wildcard. Sačekati verifikaciju i izdavanje certifikata; potvrditi HTTPS redirect i odsustvo mixed content. DNS podatke ne nagađati. Na serveru ažurirati ALLOWED_ORIGINS, Turnstile dozvoljene hostname i captcha_hostname, Supabase site/redirect URL i administratorske email linkove. Pregledati i /test/ putanju nakon nove domene. Administratorske lozinke i sadržaj forme šalju se direktno Supabase HTTPS API-ju, nikada statičkom hostingu.

Zvanični izvori pregledani 26.10.2026:
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https

## Privatnost i pravni pregled

privacy.html, terms.html i cookies.html su izričito označeni probni nacrti, nisu pravna potvrda spremnosti. Prije javnog pokretanja treba utvrditi rukovaoca i njegov odobren kontakt, pravne osnove i svrhe, rokove čuvanja/brisanja/kopija, prava nosilaca podataka i postupak zahtjeva, maloljetnike, moderaciju i protivpravan sadržaj, ugovore i međunarodne prenose kod pružalaca, obradu tehničkih evidencija, te eventualnu saglasnost za stvarnu reklamnu mrežu. Ne navoditi privatni email vlasnika bez posebnog odobrenja. Dobna granica i rok čuvanja nisu samostalno izmišljeni.

Referentni zakon za stručni pregled: Zakon o zaštiti ličnih podataka BiH, Službeni glasnik12/25, zvanični tekst https://www.sluzbenilist.ba/page/akt/aCRNh0ohz4nh78h77P7BE%3D . Ne predstavlja pravni savjet; teritorijalna primjena i eventualne dodatne obaveze zavise od publike i operatera.

Nema stvarnih oglasa, automatskog refresha, analytics SDK-a ili reklamnih kolačića u pripremljenom paketu. diagnostics.mjs čuva najviše30 fiksnih kodova greške u memoriji kartice, zaokruženo vrijeme i build. Ne čuva poruke, IP, UID, URL, stack, token ili trajne podatke i ne šalje ih na server. To nije udaljeni monitoring svih korisnika. Eventualni takav servis ostaje za poseban pregled jer i infrastrukturni zapisi mogu sadržati podatke o posjetiocima.

## SEO

Pripremljeni naslov/opis, Open Graph/Twitter summary, favicon i slika1200x630, robots i sitemap. /test/ i administracija ostaju noindex. Produkcijski builder dodaje canonical i apsolutne OG URL-ove prema SITE_ORIGIN. Generički preview linka je pripremljen; pojedinačne ispovijesti još nemaju zasebne server-renderovane metapodatke. Registracija Search Console i indeksiranje nisu izvršeni.

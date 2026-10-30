# Nastavak rada — 30.10.2026.

Preuzet je postojeći kod grane `work/admin-panel-prep-20261028`, commit
`b30d88f19db53fedb5f82e48bd16a51a392c8d38`. Nastavak je na zasebnoj grani
`work/finish-admin-20261030`. Nema redizajna ili promjena original.css/styles.css.
Nema objavljivanja glavnog sajta, zajedničkog Pages deploymenta, SQL upisa na
postojeći Supabase projekat ili promjena postojećeg administratorskog naloga.

## Završene dorade u izolovanoj probi

- Arhiva ima nastavak pretrage kroz cijelu istoriju, po 100 poruka, bez OFFSET-a.
  Server vraća `has_more` i tekstualni `next_before`; posljednja stranica sa tačno
  100 poruka ne prikazuje lažni nastavak.
- Ispravljeno sortiranje ID-eva: tekstualni ID 99 više ne ide ispred 225.
  Kontekst zadržava bigint ID kao string, bez gubitka preciznosti u browseru.
- Pretraga zadržava tekst/autora/status/datume tokom prelaska na starije poruke.
  Novi upit prekida prethodni, a stari odgovor ne prepisuje novi rezultat.
- Okolne poruke sada prikazuju datum, anonimni ID, nadimak, avatar i stanje
  zasebno za svaku poruku. Nepoznati istorijski podaci su označeni, ne izmišljeni.
- Sačuvana posljednja lokalna dorada odjave iz prethodnog razgovora: opoziv
  lokalne vlasničke sesije i zatvaranje probnog panela. To je izolovani vlasnički
  ključ; ne predstavlja stvarnu lozinku + e-mail potvrdu.
- Dodata provjera 225 poruka, promjene profila poslije slanja, novog slanja
  između stranica, filtriranja, tačne završne stranice, uklanjanja/vraćanja,
  očuvanja poruke i odluke u arhivi, odbijanja lažnih administratorskih podataka
  i odbijanja starog kolačića poslije odjave.

Ove SQL promjene su i dalje izvor izolovane probe; nisu migracija primijenjena
na postojeći projekat. Administratorski pregled cijele istorije ne mijenja
ograničenu istoriju dostupnu korisnicima chata. Chat ostaje bez reklama.

## Provjereno stvarno stanje, samo čitanjem

Supabase projekat `roxajqagksffbsbzdrap` aktivan je. Postoje `community_test`
i `chat_test`, ali ne `community_live`, `chat_live`, `recovery_sandbox` ili
`admin_archive_probe`. Aktivni su stari endpointovi i dva testna API-ja;
recovery endpoint nije na spisku postavljenih funkcija. Testne postavke imaju
uključenu CAPTCHA-u, upisane njene parametre i metodu admin potvrde e-mailom.
Prisustvo postavki nije dokaz isporuke e-maila ni stvarnog CAPTCHA E2E testa.
Tajni ključevi, e-mail i sadržaj korisnika nisu čitani ili izvezeni radi ove provjere.

## Otvorene granice završetka

1. Stvarna Resend dostava, Turnstile i oporavak lozinke nisu ovim nastavkom
   potvrđeni kroz cijeli povezani panel. Lokalna proba i raniji lokalni Supabase
   eksperiment ne zamjenjuju ovu provjeru.
2. Za tu probu već postoji registrovan zaseban privatni Site i kompletan
   recovery sandbox SQL/plan u `docs/RECOVERY-SANDBOX-20261027.md`.
   Ranija odobrenja obuhvatala su pripremu. Novi Auth projekat, tačan probni
   nalog, SQL/Edge aktivacija i privatno objavljivanje nisu potvrđeni tim planom.
   Čuvati uslov 0 KM dodatnog troška i postojeći nalog.
3. Kompletna glavna objava nije pripremljena za automatsko puštanje: arhiva,
   analitika i oglašavanje u ovoj grani još koriste lokalni probni backend.
   Analitika ostaje procjena po kartici, sa privremenim ograničenjem; oglasi
   su probni zakupi i klijentski prijavljeni prikazi. Nema stvarne naplate.
4. Istorijski nadimak/avatar koji nije ranije zabilježen nije moguće pouzdano
   rekonstruisati. Arhiva čuva sve dostupne poruke i nove snimke profila.
5. Javni kontakt, pravni tekstovi i rok čuvanja nisu samostalno određeni.

## Provjere

Cijeli lokalni regresioni skup prošao je 160/160 testova. Nakon dodatne provjere
uklanjanja/vraćanja i bigint konteksta, oba ciljana arhivska testa ponovo su
prošla. To su stvarni lokalni PostgreSQL/PGlite i HTTP testovi sa sintetičkim
podacima, bez produkcijske mreže ili stvarnog maila/CAPTCHA.

Sites preview je pokrenut i stranica probne prijave pregledana u cloud browseru.
Prikaz panela poslije prijave i nova paginacija nisu u browseru provjereni:
probna prijava zahtijeva odvojeni generisani lokalni vlasnički ključ. Nije
unesena ili promijenjena stvarna lozinka i nije zaobiđena zaštita prijave.

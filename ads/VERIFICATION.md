# Provjera pripreme reklama

- 81 automatski test prolazi. Testovi koriste lokalnu privremenu bazu, ne Supabase projekat.
- U pregledniku je završena probna reklama za komentar: saldo je postao 1, a za druge vrste ostao 0.
- Označeno probno otključavanje potrošeno je tek nakon lokalnog uspješnog upisa komentara; saldo je ponovo 0.
- U mobilnom okviru 390 × 844 izmjerena širina stranice i viewporta je jednaka (375 bez trake skrolovanja): nema horizontalnog prelivanja.
- Mobilni prekid probne reklame ostavio je sve salde na 0 i prikazao poruku o prekidu.
- Baner je u normalnom toku stranice, iznad priča; ne prekriva tekst, a dugme + je odvojeno.
- Za lokalni HTTP pregled dodata je kriptografska UUID kompatibilnost; tajmer radi u stvarnom pregledniku.
- Stvarne reklamne mreže nisu kontaktirane. Nema odobrenja mreže, prihoda, pravih pregleda ili potvrđenih produkcijskih nagrada.
- Produkciona baza, postojeći podaci, /test/, main grana i ranije pripremljeni produkcijski PR nisu mijenjani.

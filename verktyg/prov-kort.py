# -*- coding: utf-8 -*-
"""Prov for kortet i flodessidorna - issue #32.

VARFOR DET HAR FINNS
====================
`koppla_in()` i verktyg/ny-artikel.py var idempotent pa slug: fanns slugen i
insikter.html/insights.html skrev den `fanns redan` och hoppade over. Det
hindrade dubbla kort, men gjorde ocksa att en RATTAD ingress aldrig nadde kortet
- och utan att nagot sa till. Avslutkod 0.

Generatorn jamfor nu kortet mot specen. Det har provet kor generatorn pa en KOPIA
av repots riktiga flodessidor och kraver:

  a) nytt kort laggs in i bada flodena
  b) andra korningen utan andring = oforandrat, ingen dubblett, filerna orora
  c) andrad ingress i specen nar kortet i bada flodena
  d) ett kort som inte gar att tolka ger felkod != 0 - och INGENTING skrivs,
     inte heller i det andra spraket (regel 2: flodena far inte glida isar)
  e) dubbla kort for samma slug ger felkod
  f) slugen namns men inget tolkbart kort finns ger felkod (inget andra kort)
  g) sjalvprovet faller nar kortet skiljer sig fran specen
  h) ett korrekt kort plus en handredigerad kopia (annat indrag) ger felkod

    python verktyg/prov-kort.py

Alla steg kors, sedan rapporteras summan. Ett enda fel ger avslutkod 1.
"""
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLODEN = ("insikter.html", "insights.html")
SLUG = {"sv": "insikter-provkortet", "en": "insights-the-test-card"}

SPEC = {
    "slug": SLUG,
    "datum": "2026-10-16",
    "datum_text": {"sv": "16 oktober 2026", "en": "16 October 2026"},
    "lastid": "1 min",
    "sidtitel": {"sv": "Provkortet", "en": "The test card"},
    "titel": {"sv": "Provkortet", "en": "The test card"},
    "ingress": {"sv": "En <em>gammal</em> ingress.", "en": "An <em>old</em> lead."},
    "block": [{"typ": "p", "text": {"sv": "Text.", "en": "Text."}}],
}


def las(p):
    return io.open(p, encoding="utf-8").read()


def skriv(p, innehall):
    # Argumentet (ofta las(p)) beraknas FORE oppningen, och skrivningen gar via
    # .tmp. `open(p, "w").write(las(p))` trunkerar filen innan den lases - den
    # forsta versionen av provet gjorde just det och provade en tom sida.
    data = innehall.encode("utf-8")
    open(p + ".tmp", "wb").write(data)
    os.replace(p + ".tmp", p)


def bygg_trad(d):
    os.makedirs(os.path.join(d, "verktyg", "artiklar"))
    for f in ("ny-artikel.py", "artikelmall.html"):
        shutil.copy(os.path.join(ROT, "verktyg", f), os.path.join(d, "verktyg", f))
    for f in FLODEN + ("sitemap.xml",):
        shutil.copy(os.path.join(ROT, f), os.path.join(d, f))
    skriv_spec(d, SPEC)


def skriv_spec(d, spec):
    io.open(os.path.join(d, "verktyg", "artiklar", "prov.json"), "w",
            encoding="utf-8").write(json.dumps(spec, ensure_ascii=False))


def kor(d, *arg):
    if not arg:
        arg = (os.path.join(d, "verktyg", "artiklar", "prov.json"),)
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    p = subprocess.Popen([sys.executable, os.path.join(d, "verktyg", "ny-artikel.py")] + list(arg),
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    ut, fel = p.communicate()
    return p.returncode, ut.decode("utf-8", "replace"), fel.decode("utf-8", "replace")


def antal_kort(d, flode, lang):
    return las(os.path.join(d, flode)).count('<h3><a href="/%s">' % SLUG[lang])


def ogonblick(d):
    """Byte-bild av flodena OCH artikelsidorna (om de finns) - "ingenting skrevs"
    ska galla alla filer generatorn ror, inte bara korten."""
    filer = list(FLODEN) + [SLUG[l] + ".html" for l in ("sv", "en")]
    return dict((f, open(os.path.join(d, f), "rb").read())
                for f in filer if os.path.exists(os.path.join(d, f)))


class Prov(object):
    def __init__(self):
        self.fel = 0
        self.antal = 0

    def krav(self, namn, villkor, detalj=""):
        self.antal += 1
        if villkor:
            print("  ok    %s" % namn)
        else:
            print("::error::%s" % namn)
            if detalj:
                print("        " + detalj.strip().replace("\n", "\n        ")[:600])
            self.fel = 1


def main():
    pr = Prov()
    d = tempfile.mkdtemp(prefix="kortprov-")
    try:
        bygg_trad(d)
        fore = dict((f, las(os.path.join(d, f)).count('<div class="card">')) for f in FLODEN)

        # a) nytt kort
        kod, ut, felut = kor(d)
        print("--- a) forsta korningen\n" + ut.rstrip())
        pr.krav("a) exit 0", kod == 0, felut)
        pr.krav("a) bada flodena rapporterar 'kort inlagt overst'",
                ut.count("kort inlagt overst") == 2, ut)
        for f, lang in zip(FLODEN, ("sv", "en")):
            pr.krav("a) %s har exakt ett kort for slugen" % f, antal_kort(d, f, lang) == 1)
            pr.krav("a) %s har ett kort mer an fore" % f,
                    las(os.path.join(d, f)).count('<div class="card">') == fore[f] + 1)
            pr.krav("a) %s visar specens ingress" % f,
                    "<li>%s</li>" % SPEC["ingress"][lang] in las(os.path.join(d, f)))

        # b) andra korningen utan andring
        snap = ogonblick(d)
        kod, ut, felut = kor(d)
        print("--- b) andra korningen, ingen andring\n" + ut.rstrip())
        pr.krav("b) exit 0", kod == 0, felut)
        pr.krav("b) bada flodena rapporterar 'kort oforandrat'",
                ut.count("kort oforandrat") == 2, ut)
        pr.krav("b) ingen dubblett", all(antal_kort(d, f, l) == 1
                                          for f, l in zip(FLODEN, ("sv", "en"))))
        pr.krav("b) flodessidorna ar byte-identiska", ogonblick(d) == snap)

        # c) andrad ingress nar kortet
        spec2 = json.loads(json.dumps(SPEC))
        spec2["ingress"] = {"sv": "En rattad ingress.", "en": "A corrected lead."}
        skriv_spec(d, spec2)
        kod, ut, felut = kor(d)
        print("--- c) ingressen andrad i specen\n" + ut.rstrip())
        pr.krav("c) exit 0", kod == 0, felut)
        pr.krav("c) bada flodena rapporterar 'kort uppdaterat (ingress)'",
                ut.count("kort uppdaterat (ingress)") == 2, ut)
        for f, lang in zip(FLODEN, ("sv", "en")):
            s = las(os.path.join(d, f))
            pr.krav("c) %s visar den nya ingressen" % f,
                    "<li>%s</li>" % spec2["ingress"][lang] in s)
            pr.krav("c) %s har inte kvar den gamla" % f, SPEC["ingress"][lang] not in s)
            pr.krav("c) %s har fortfarande exakt ett kort" % f, antal_kort(d, f, lang) == 1)

        # g) sjalvprovet ser ett kort som skiljer sig fran specen
        snap = ogonblick(d)
        p_en = os.path.join(d, "insights.html")
        skriv(p_en, 
            las(p_en).replace(spec2["ingress"]["en"], "A stale lead."))
        kod, ut, felut = kor(d, "--sjalvprov")
        print("--- g) sjalvprov med inaktuellt kort (utdrag)")
        print("\n".join(r for r in ut.splitlines() if "kortet" in r))
        pr.krav("g) sjalvprovet ger exit != 0", kod != 0, ut)
        pr.krav("g) sjalvprovet pekar ut kortet och faltet",
                "skiljer sig fran specen (ingress)" in ut, ut)
        for f, b in snap.items():
            open(os.path.join(d, f), "wb").write(b)

        # d) otolkbart kort: extra rad i EN-kortet, samtidigt som SV skulle uppdateras
        spec3 = json.loads(json.dumps(spec2))
        spec3["ingress"] = {"sv": "En tredje ingress.", "en": "A third lead."}
        skriv_spec(d, spec3)
        skriv(p_en, las(p_en).replace(
            '          <ul>\n            <li>%s</li>' % spec2["ingress"]["en"],
            '          <p class="note">Handskriven rad</p>\n'
            '          <ul>\n            <li>%s</li>' % spec2["ingress"]["en"]))
        snap = ogonblick(d)
        kod, ut, felut = kor(d)
        print("--- d) otolkbart kort i insights.html\n" + (ut + felut).rstrip())
        pr.krav("d) exit != 0", kod != 0, ut + felut)
        pr.krav("d) meddelandet sager att kortet inte gar att tolka",
                "gar inte att tolka" in felut and "insights.html" in felut, felut)
        pr.krav("d) bilden omfattar flodena och bada artikelsidorna", len(snap) == 4)
        pr.krav("d) ingenting skrevs - varken floden (inte heller insikter.html) eller "
                "artikelsidor", ogonblick(d) == snap)
        pr.krav("d) inget tyst 'fanns redan' i utdatan", "fanns redan" not in ut + felut)

        # e) dubbla kort
        shutil.rmtree(d)
        bygg_trad(d)
        kor(d)
        s = las(p_en)
        start = s.index('        <div class="card">\n          <span class="tag">Insights</span>\n'
                        '          <h3><a href="/%s">' % SLUG["en"])
        slut = s.index("        </div>\n", start) + len("        </div>\n")
        skriv(p_en, s[:slut] + s[start:slut] + s[slut:])
        snap = ogonblick(d)
        kod, ut, felut = kor(d)
        print("--- e) dubbla kort\n" + felut.rstrip())
        pr.krav("e) exit != 0", kod != 0, ut + felut)
        pr.krav("e) meddelandet namner dubbletter", "dubbletter" in felut, felut)
        pr.krav("e) ingenting skrevs", ogonblick(d) == snap)

        # f) slugen namns, men kortet har annat indrag och kan inte hittas
        skriv(p_en, s.replace(
            '        <div class="card">\n          <span class="tag">Insights</span>\n'
            '          <h3><a href="/%s">' % SLUG["en"],
            '      <div class="card">\n          <span class="tag">Insights</span>\n'
            '          <h3><a href="/%s">' % SLUG["en"]))
        snap = ogonblick(d)
        kod, ut, felut = kor(d)
        print("--- f) slugen namns men inget tolkbart kort\n" + felut.rstrip())
        pr.krav("f) exit != 0", kod != 0, ut + felut)
        pr.krav("f) meddelandet sager att inget andra kort laggs till",
                "lagger inte till ett andra kort" in felut, felut)
        pr.krav("f) ingenting skrevs", ogonblick(d) == snap)

        # h) granskningsfynd 1 (#33): ett korrekt kort PLUS en handredigerad kopia
        # med annat indrag och gammal ingress. Forsta versionen skrev om det
        # tolkbara kortet med exit 0 och lamnade kopian kvar med den gamla texten.
        kort = s[start:slut]
        kopia = "\n".join(("  " + r[2:]) if r.startswith("  ") else r
                          for r in kort.replace("<li>%s</li>" % SPEC["ingress"]["en"],
                                                "<li>Stale lead.</li>").split("\n"))
        skriv(p_en, s[:slut] + kopia.replace("        <div", "      <div", 1) + s[slut:])
        spec_h = json.loads(json.dumps(SPEC))
        spec_h["ingress"] = {"sv": "Ny ingress h.", "en": "New lead h."}
        skriv_spec(d, spec_h)
        snap = ogonblick(d)
        kod, ut, felut = kor(d)
        print("--- h) korrekt kort plus handredigerad kopia med annat indrag\n" + felut.rstrip())
        pr.krav("h) exit != 0", kod != 0, ut + felut)
        pr.krav("h) meddelandet pekar pa mojlig dubblett",
                "mojlig handredigerad dubblett" in felut, felut)
        pr.krav("h) ingenting skrevs", ogonblick(d) == snap)
        kod, ut, felut = kor(d, "--sjalvprov")
        pr.krav("h) sjalvprovet faller ocksa", kod != 0 and "mojlig handredigerad dubblett" in ut,
                ut)
    finally:
        shutil.rmtree(d, ignore_errors=True)

    print("\n%d krav provade, %s." % (pr.antal, "alla ok" if not pr.fel else "MINST ETT FEL"))
    return pr.fel


if __name__ == "__main__":
    sys.exit(main())

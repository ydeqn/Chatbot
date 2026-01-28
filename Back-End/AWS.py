import json 
import boto3 
import urllib.request
import os 

# KONFIGURATION 
#Name des S3 Buckets, in dem die Tabelle mit den Informationen über die Informationen hinterlegt ist 
S3_BUCKET = "wagp-regional-carrer-bot-group9" 
#Name der .json Datei im S3 Bucket 
S3_FILE = "wissen.json"
#OpenAI API Key wird aus der Environment Variable gelesen
# (wird in AWS Lambda unter "Environment Variables" gesetzt) # Hier .json Dateinamen eingeben
API_KEY = os.getenv("OPENAI_API_KEY")                 # Hier den OpenAI API Key der Gruppe eintragen 
#Debug-Ausgabe: Prüft, ob der API-Key gesetzt ist
print("API_KEY gesetzt:", bool(API_KEY))

# S3-Client initialisieren, um auf AWS S3 zugreifen zu können
s3 = boto3.client('s3') 
#Hauptfunktion
#Diese Funktion ist der Einstiegspunkt des Chatbots. 
#Sie wird automatisch aufgerufen sobald eine Anfrage eingeht
def lambda_handler(event, context): 

    # 1. User-Frage auslesen (aus der Anfrage) 

    frage = event.get('frage') 

    # 2. Wissen aus S3 laden 

    obj = s3.get_object(Bucket=S3_BUCKET, Key=S3_FILE) 
    # Der Inhalt der Datei wird als Text eingelesen
    wissen = obj['Body'].read().decode('utf-8') 

 

    # 3. KI Logik – Hier die Logik der gewählten KI inkl. Prompt, API-Key, Modell, etc. eintragen 

    #Adresse des KI Dienstes
    url = "https://api.openai.com/v1/responses"

    #Erklärung an die KI, welches Wissen darf sie verwenden.
    #Welche Rolle hat sie
    #Wie soll die KI vorgehen und Antworten
    prompt = f"""
    ==================================================
**1. ROLLE**
==================================================
Du agierst in der Rolle eines **digitalen Karriereberaters**
für **Ingenieurstudierende der TH Köln – Campus Gummersbach**.

==================================================
**2. AUFGABE**
==================================================
Deine Aufgabe ist es, Studierende bei der **regionalen Stellensuche
für Grundpraktika** zu unterstützen.

- Formuliere Empfehlungen realistisch und studierendenorientiert.
- Berücksichtige, dass es sich um ein Grundpraktikum handelt
  und nicht um eine vollwertige Stelle.

==================================================
**3. KONTEXT & DATENBASIS**
==================================================
Dir liegt eine **strukturierte Tabelle** vor.

- Jede **Zeile** entspricht einem Unternehmen.
- Jede **Spalte** beschreibt Eigenschaften dieses Unternehmens.

Mögliche Eigenschaften sind u. a.:
- Tätigkeit
- Unternehmensgröße
- Erreichbarkeit mit Bus/Bahn
- Bewerbungsportal verfügbar (ja/nein)
- Kontakt vorhanden (ja/nein)
- Abgleich mit den Vorgaben für das Grundpraktikum
- Erforderliche Vorerfahrung (keine / gering / hoch)
- Quelle der Information

==================================================
**4. VERBINDLICHE VORGABEN ZUM GRUNDPRAKTIKUM**
==================================================
Das Grundpraktpraktikum erstreckt sich über 6 Wochen (30Arbeitsttage).
Das Grundpraktikum ist in einem Industrie- oder Handwerksbetrieb durchzuführen
und soll praktische Tätigkeiten aus zwei der folgenden Bereiche enthalten:

1. Arbeitstechniken an Metallen, Kunststoffen, technischer Keramik oder Glas.
2. Arbeitstechniken mit Maschinen der zerspanenden und / oder
   spanlosen Formgebung.
3. Verbindungstechniken und / oder Wärmebehandlungen,
   Oberflächen-Behandlungen.
4. Grundausbildung in der Elektrotechnik Installationen, elektrische
   Maschinen, Schalt- und / oder Messgeräte.

==================================================
**5. ZENTRALE REGELN (SEHR WICHTIG)**
==================================================
- Die Tabelle ist deine **einzige und primäre Wissensquelle**.
- Jede Aussage über ein Unternehmen muss **direkt aus der Tabelle ableitbar** sein.
- **Erfinde keine Unternehmen, Eigenschaften oder Zusammenhänge.**
- Schlage **ausschließlich Unternehmen aus der Tabelle** vor.
- Gib **keine rechtlich verbindlichen Aussagen oder Garantien**.

==================================================
**6. TRANSPARENZ ÜBER UNSICHERHEITEN**
==================================================
- Wenn du dir bei einer Einschätzung unsicher bist,
  **musst du dies explizit kenntlich machen**.
- Verwende dann die Formulierung:
  **"Ich bin mir unsicher, weil …"**
- Die Unsicherheit muss sachlich begründet sein
  (z. B. fehlende oder unklare Angaben in der Tabelle).

==================================================
**7. VORGEHEN / ANALYSE**
==================================================
- Lies die Tabelle vollständig und sorgfältig.
- Vergleiche die Eigenschaften der Unternehmen mit dem Profil des Nutzers.
- Priorisiere Unternehmen danach, wie gut sie
  zu den Anforderungen und Rahmenbedingungen des Nutzers passen.

==================================================
**8. PRIORISIERUNGSKRITERIEN**
==================================================
Berücksichtige insbesondere:
- Übereinstimmung der Tätigkeit
- Erfüllung der Vorgaben für das Grundpraktikum
- Erreichbarkeit mit Bus und Bahn
- Erforderliche Vorerfahrung
- Bewerbungsfreundlichkeit (Portal oder direkter Kontakt)
- Passung zu den vorgegebenen Praxisbereichen

==================================================
**9. UMGANG MIT FEHLENDEN INFORMATIONEN**
==================================================
- Wenn der Nutzer nicht alle relevanten Kriterien nennt
  (z. B. Tätigkeit, Erreichbarkeit, Vorerfahrung),
  stelle gezielte Rückfragen.
- Erstelle **keine priorisierte Liste**, solange zentrale Informationen fehlen.

==================================================
**10. ANTWORTFORMAT (VERBINDLICH)**
==================================================
Beginne deine Antwort exakt mit:

"Hier ist deine **priorisierte Liste an Unternehmen**,
bei denen du dich bewerben kannst:"

1. Unternehmen A
2. Unternehmen B
3. Unternehmen C

**Begründung:**
- Unternehmen A passt zu dir, weil …
- Unternehmen B passt zu dir, weil …

Die Begründung muss sich jeweils explizit beziehen auf:
- das Nutzerprofil,
- die Eigenschaften aus der Tabelle,
- und die Vorgaben des Grundpraktikums.

==================================================
**11. QUELLENANGABEN**
==================================================
- Gib bei **jedem vorgeschlagenen Unternehmen**
  die **Quelle** an, die in der Tabelle hinterlegt ist.
- Die Quelle muss eindeutig dem jeweiligen Unternehmen zugeordnet sein.

==================================================
**12. KEINE EMPFEHLUNG MÖGLICH**
==================================================
- Wenn auf Basis der Tabelle keine sinnvolle Empfehlung möglich ist,
  weise klar darauf hin und begründe dies sachlich
  (z. B. fehlende Übereinstimmungen oder unvollständige Angaben).

==================================================
**13. WISSEN (TABELLE)**
==================================================
{wissen}

==================================================
**14. FRAGE DES NUTZERS**
==================================================
{frage}
"""

#Welches KI Modell wird genutzt und welcher Text wird an sie gesendet
    data = {
    "model": "gpt-5-nano",
    "input": prompt
}
# Anfrage an die KI senden
#Die Anfrage wird mit dem Zugriffsschüssel (API-Key) an die KI geschickt  

    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}) 
    #Die Antwort der KI wird empfangen
    response = urllib.request.urlopen(req) 
    #Die Antwort wird in ein lesbareres Format umgewandelt
    raw = json.loads(response.read())
    #Ausgabe der vollständigen KI-Ausgabe zur Kontrolle (Debug)
    print("OpenAI RAW RESPONSE:", json.dumps(raw, indent=2))
    

    #Verständliche Antwort aus der KI-Ausgabe herausfiltern
    #default antwort solange es 
    antwort = "Keine Antwort erhalten."
    # Die Antwort der KI kann in unterschiedlichen Strukturen zurückgegeben werden.
    # In manchen Fällen enthält die Antwort direkt ein Feld namens "output_text",
    # das den eigentlichen Antworttext enthält. Dieser wird durch diesen Code direkt ausgegeben
    if "output_text" in raw:
        antwort = raw["output_text"]
    #es gibt den key Output im Dictionary raw und dieser key hat mindestens ein Element
    elif "output" in raw and len(raw["output"]) > 0:
        #Iteration über jeden Wert der Liste Output
        for item in raw["output"]:
            #hat das aktuelle Dictionary einen key item?
            if "content" in item:
                #wenn ja wird über alle Werte der Liste hinter dem kex content iteriert
                for block in item["content"]:
                    #ist dieses Element vom Typ Output Text?
                    if block.get("type") == "output_text":
                        #wenn ja speicher in der Variable antwort den Text von diesem Block
                        antwort = block.get("text")
                        #Die Suche wird beenedet da die gewünste Antwort gefunden wurde
                        break

    # Die finale Antwort wird an das aufrufende System zurückgegeben,
    # z. B. an ein Frontend oder eine andere Programmschnittstelle
    return {"antwort": antwort} 

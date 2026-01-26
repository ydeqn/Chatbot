import json
import boto3
import urllib.request
import os

# KONFIGURATION
S3_BUCKET = "wagp-regional-carrer-bot-group9"
S3_FILE = "wissen.json"
API_KEY = os.getenv("OPENAI_API_KEY")
print("API_KEY gesetzt:", bool(API_KEY))

s3 = boto3.client('s3')

def lambda_handler(event, context):
    # Handle CORS preflight request (OPTIONS)
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            'body': ''
        }
    
    try:
        # Debug: Log the complete incoming event
        print("=" * 50)
        print("RECEIVED EVENT:")
        print(json.dumps(event, indent=2, default=str))
        print("=" * 50)
        
        # 1. User-Frage auslesen
        frage = None
        
        if 'body' in event:
            print(f"Event has 'body' field, type: {type(event['body'])}")
            print(f"Body content: {event['body']}")
            
            if isinstance(event['body'], str):
                try:
                    body = json.loads(event['body'])
                    print(f"Parsed body: {body}")
                    frage = body.get('frage')
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
                            'Access-Control-Allow-Methods': 'POST,OPTIONS'
                        },
                        'body': json.dumps({'antwort': f'Fehler beim Parsen der Anfrage: {str(e)}'})
                    }
            else:
                body = event['body']
                frage = body.get('frage')
        else:
            print("Event does NOT have 'body' field, using event directly")
            frage = event.get('frage')
        
        print(f"Extracted frage: '{frage}'")
        
        if not frage:
            print("WARNING: frage is empty or None")
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
                    'Access-Control-Allow-Methods': 'POST,OPTIONS'
                },
                'body': json.dumps({'antwort': 'Keine Frage erhalten. Bitte sende eine Nachricht im Format: {"frage": "deine Frage"}'})
            }

        # 2. Wissen aus S3 laden
        obj = s3.get_object(Bucket=S3_BUCKET, Key=S3_FILE)
        wissen = obj['Body'].read().decode('utf-8')

        # 3. KI Logik – OpenAI API Aufruf
        url = "https://api.openai.com/v1/chat/completions"

        prompt = f"""Du bist ein digitaler Karriereberater für Ingenieurstudierende der TH Köln am Campus Gummersbach.

Deine Aufgabe ist es, Studierende bei der regionalen Stellensuche für Grundpraktika zu unterstützen. Assistiere Studenten bei der Suche und ebenfalls anderen Fragen.

Regeln:
- Nutze ausschließlich das unten bereitgestellte Wissen, falls für Karriereempfehlungen nachgefragt wird.
- Erfinde keine Unternehmen oder Fakten.
- Gib keine rechtlich verbindlichen Aussagen oder Garantien.

Vorgehen:
1. Prüfe, welche Unternehmen aus dem Wissen zur Frage passen.
2. Priorisiere die passendsten Unternehmen.
3. Begründe kurz, warum diese Unternehmen geeignet sind.

Antworte verständlich und strukturiert.

WISSEN:
{wissen}

FRAGE:
{frage}
"""

        data = {
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "system",
                    "content": "Du bist ein hilfreicher digitaler Karriereberater für Ingenieurstudierende."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 1000
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode(),
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            }
        )
        
        response = urllib.request.urlopen(req)
        raw = json.loads(response.read())
        
        print("OpenAI RAW RESPONSE:", json.dumps(raw, indent=2))
        
        antwort = "Keine Antwort erhalten."
        
        if "choices" in raw and len(raw["choices"]) > 0:
            antwort = raw["choices"][0]["message"]["content"]
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            'body': json.dumps({'antwort': antwort})
        }
        
    except Exception as e:
        print(f"FEHLER: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            'body': json.dumps({'antwort': f'Ein Fehler ist aufgetreten: {str(e)}'})
        }
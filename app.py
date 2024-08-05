from flask import Flask, request, jsonify, send_from_directory
import requests
import json
import os
from dotenv import load_dotenv
from datetime import datetime

# Lade die Umgebungsvariablen aus der .env-Datei
load_dotenv()

app = Flask(__name__, static_folder='static')

# Home Assistant Konfiguration
HA_URL = os.getenv('HA_URL')
HA_TOKEN = os.getenv('HA_TOKEN')
CALENDAR_ENTITY_IDS = json.loads(os.getenv('CALENDAR_ENTITY_IDS'))

# Funktion zum Laden der Schicht-Zeiten aus der JSON-Datei


def load_shifts():
    with open('shifts_config.json', 'r', encoding='utf-8') as file:
        return json.load(file)


shifts = load_shifts()

# Funktion zur Formatierung von Namen und Schichttypen


def format_name(name):
    return name.capitalize()


def format_shift_type(shift_type):
    return shift_type.capitalize()


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/options', methods=['GET'])
def get_options():
    response = jsonify({
        'names': [format_name(name) for name in CALENDAR_ENTITY_IDS.keys()],
        'shift_types': [format_shift_type(shift_type) for shift_type in next(iter(shifts.values())).keys()]
    })
    response.charset = 'utf-8'
    return response


@app.route('/api/shift_types/<name>', methods=['GET'])
def get_shift_types(name):
    name = name.lower()
    if name in shifts:
        shift_types = list(shifts[name].keys())
        return jsonify({'shift_types': shift_types})
    else:
        return jsonify({'shift_types': []}), 404


@app.route('/add_shifts', methods=['POST'])
def add_shifts():
    shifts_data = request.json
    results = []

    for shift in shifts_data:
        name = format_name(shift['name'].lower())
        date_str = shift['date']
        shift_type = format_shift_type(shift['shift_type'].lower())

        if name.lower() not in CALENDAR_ENTITY_IDS or shift_type.lower() not in shifts[name.lower()]:
            results.append(f"Unbekannter Name oder Schichttyp: {
                           name}, {shift_type}")
            continue

        start_time = shifts[name.lower()][shift_type.lower()]['start']
        end_time = shifts[name.lower()][shift_type.lower()]['end']
        start_date_time = f'{date_str} {start_time}'
        end_date_time = f'{date_str} {end_time}'
        summary = f'{name}: {shift_type}-Schicht'
        description = f'Schicht von {start_time} bis {end_time}'

        url = f'{HA_URL}/api/services/calendar/create_event'
        headers = {
            'Authorization': f'Bearer {HA_TOKEN}',
            'Content-Type': 'application/json',
        }
        data = {
            "entity_id": CALENDAR_ENTITY_IDS[name.lower()],
            "summary": summary,
            "description": description,
            "start_date_time": start_date_time,
            "end_date_time": end_date_time
        }
        response = requests.post(url, json=data, headers=headers)
        if response.status_code == 200:
            results.append(f'Ereignis hinzugefügt: {summary} am {date_str}')
        else:
            results.append(f'Fehler beim Hinzufügen von {
                           summary} am {date_str}: {response.text}')

    return jsonify(results)


if __name__ == '__main__':
    app.run(debug=True)

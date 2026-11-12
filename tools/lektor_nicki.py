# Lektor DartsMaster — nagrywa nicki graczy głosem „George” (Kokoro TTS, Apache 2.0).
# Uruchamia go GitHub Actions (.github/workflows/lektor-nicki.yml), nie Vercel.
# Bierze nicki z Firestore (kolekcja users, pole nick) + z pliku tools/nicki.txt,
# nagrywa tylko brakujące do media/voice/names/<slug>.mp3 i dopisuje je do voice-names.json.
import os, re, sys, json, wave, subprocess, tempfile, urllib.request, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'media', 'voice', 'names')
INDEX = os.path.join(ROOT, 'voice-names.json')
VOICES = os.path.join(ROOT, 'tools', 'voice-george.bin')
MODEL = os.environ.get('KOKORO_MODEL', os.path.join(tempfile.gettempdir(), 'kokoro-v1.0.int8.onnx'))
MODEL_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx'

PL = str.maketrans('ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzACELNOSZZ')
def slug(n):  # MUSI być identyczne z funkcją slug() w caller.html
    s = unicodedata.normalize('NFKD', (n or '').translate(PL)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:40]

def spoken(t):
    t = re.sub(r'[_\-.]+', ' ', t or '')
    t = re.sub(r'([a-ząćęłńóśźż])([A-ZĄĆĘŁŃÓŚŹŻ])', r'\1 \2', t)   # KubaNowak → Kuba Nowak
    t = re.sub(r"[^0-9A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż' ]+", ' ', t)
    return re.sub(r'\s+', ' ', t).strip()[:28]

def skip(n):
    n = (n or '').strip()
    return not n or re.match(r'^(gracz|player|p)\s*\d*$', n, re.I) or re.match(r'^(ty|ja|you|me|bot|cpu)$', n, re.I)

def nicks_firestore():
    sa = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    if not sa:
        print('brak FIREBASE_SERVICE_ACCOUNT — pomijam Firestore'); return []
    import firebase_admin
    from firebase_admin import credentials, firestore
    firebase_admin.initialize_app(credentials.Certificate(json.loads(sa)))
    out = []
    for d in firestore.client().collection('users').select(['nick', 'username', 'displayName']).stream():
        x = d.to_dict() or {}
        n = x.get('nick') or x.get('username') or x.get('displayName')
        if n: out.append(str(n))
    return out

def nicks_file():
    p = os.path.join(ROOT, 'tools', 'nicki.txt')
    if not os.path.exists(p): return []
    return [l.strip() for l in open(p, encoding='utf-8') if l.strip() and not l.startswith('#')]

def main():
    os.makedirs(OUT, exist_ok=True)
    idx = json.load(open(INDEX)) if os.path.exists(INDEX) else {}
    todo = {}
    for n in nicks_file() + nicks_firestore():
        s = slug(n)
        if skip(n) or not s or not spoken(n): continue
        if s in idx and os.path.exists(os.path.join(OUT, s + '.mp3')): continue
        todo.setdefault(s, n)
    print('nowe nicki:', len(todo))
    if '--check' in sys.argv:  # szybki test w GitHub Actions — bez instalowania syntezatora
        go = os.environ.get('GITHUB_OUTPUT')
        if go: open(go, 'a').write('nowe=%d\n' % len(todo))
        return
    if not todo:
        return
    if not os.path.exists(MODEL) or os.path.getsize(MODEL) < 50_000_000:
        urllib.request.urlretrieve(MODEL_URL, MODEL + '.part'); os.replace(MODEL + '.part', MODEL)
    import numpy as np
    from kokoro_onnx import Kokoro
    k = Kokoro(MODEL, VOICES)
    for s, n in sorted(todo.items()):
        a, sr = k.create(spoken(n) + '.', voice='bm_george', speed=0.9, lang='en-gb')
        a = np.asarray(a, dtype=np.float32)
        i = np.where(np.abs(a) > 0.01)[0]
        if len(i): a = a[max(0, i[0] - int(sr * 0.01)): i[-1] + int(sr * 0.06)]
        a = a / (float(np.max(np.abs(a))) or 1.0) * 0.89
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f: wav = f.name
        with wave.open(wav, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((a * 32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-ar', '24000', '-b:a', '56k',
                        os.path.join(OUT, s + '.mp3')], check=True)
        os.unlink(wav)
        idx[s] = 1
        print('  +', n, '→', s + '.mp3')
    json.dump(dict(sorted(idx.items())), open(INDEX, 'w'), indent=0)

if __name__ == '__main__':
    main()

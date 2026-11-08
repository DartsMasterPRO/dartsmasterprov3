// Vercel Serverless Function: wysyła powiadomienie push o zaproszeniu do gry.
// Wymaga zmiennej środowiskowej FIREBASE_SERVICE_ACCOUNT (cały JSON klucza konta usługi z Firebase).
const admin = require('firebase-admin');

function app() {
  if (admin.apps.length) return admin.app();
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  return admin.initializeApp({ credential: admin.credential.cert(sa) });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(501).json({ error: 'push not configured' });
  try {
    app();
    const idToken = (req.headers.authorization || '').replace(/^Bearer /, '');
    const caller = await admin.auth().verifyIdToken(idToken);
    const { to, roomId } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!to || !roomId || typeof to !== 'string' || typeof roomId !== 'string') return res.status(400).json({ error: 'bad request' });

    const db = admin.firestore();
    const room = await db.collection('rooms').doc(roomId).get();
    if (!room.exists) return res.status(404).json({ error: 'room' });
    const r = room.data();
    // tylko gracz z tego pokoju może zapraszać i tylko osobę, którą faktycznie zaprosił
    const inRoom = (r.players || []).some(p => p.uid === caller.uid);
    const inv = (r.invites || {})[to];
    if (!inRoom || !inv || inv.fromUid !== caller.uid || Date.now() - (inv.ts || 0) > 15 * 60 * 1000) return res.status(403).json({ error: 'forbidden' });

    const user = await db.collection('users').doc(to).get();
    const tokens = Object.keys((user.exists && user.data().fcmTokens) || {});
    if (!tokens.length) return res.status(200).json({ sent: 0 });

    const modes = { 501: '501', 301: '301', cricket: 'Cricket', atc: 'Around the Clock' };
    const out = await admin.messaging().sendEachForMulticast({
      tokens,
      webpush: {
        notification: {
          title: '📨 ' + (inv.fromNick || 'Gracz') + ' zaprasza Cię do gry',
          body: (modes[r.mode] || r.mode || 'Darts') + ' — dotknij, żeby dołączyć',
          icon: '/icon-192x192.png', tag: 'invite-' + roomId, requireInteraction: true
        },
        fcmOptions: { link: '/app?invite=' + encodeURIComponent(roomId) }
      },
      data: { type: 'invite', roomId, link: '/app?invite=' + roomId }
    });
    // usuń nieaktualne tokeny
    const dead = {};
    out.responses.forEach((x, i) => { if (!x.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test((x.error && x.error.code) || '')) dead['fcmTokens.' + tokens[i]] = admin.firestore.FieldValue.delete(); });
    if (Object.keys(dead).length) await db.collection('users').doc(to).update(dead).catch(() => {});
    return res.status(200).json({ sent: out.successCount });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};

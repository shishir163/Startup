// শুরুর পাতা: অফলাইনেও খোলার জন্য ছোট service worker
const CACHE = 'macstart-v4';
const ASSETS = ['./', 'index.html', 'manifest.json', 'icon.svg', 'firebase-config.js'];
// ফন্ট আর Firebase-এর নির্দিষ্ট সংস্করণের ফাইল একবার নামলে অফলাইনেও থাকবে
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function store(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (CDN_HOSTS.includes(url.hostname)) {
    // Firebase-এর শুধু ফাইলগুলো (/firebasejs/) রাখি, ডেটার অনুরোধ নয়
    if (url.hostname === 'www.gstatic.com' && !url.pathname.startsWith('/firebasejs/')) return;
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => store(req, res))));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // পাতা আর Firebase-এর তথ্যের ফাইল: আগে নেট থেকে, না পেলে ক্যাশ থেকে
  const fresh = req.mode === 'navigate' || url.pathname.endsWith('/') ||
    url.pathname.endsWith('index.html') || url.pathname.endsWith('firebase-config.js');
  if (fresh) {
    e.respondWith(
      fetch(req).then((res) => store(req, res))
        .catch(() => caches.match(req).then((h) => h || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
    );
    return;
  }

  // বাকি ফাইল: ক্যাশ থেকে দেখায়, পাশাপাশি নতুন কপি এনে রাখে
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => store(req, res)).catch(() => hit);
      return hit || net;
    })
  );
});

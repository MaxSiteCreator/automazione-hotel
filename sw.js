const C = 'pannello-v11';
self.addEventListener('install', function(e){ self.skipWaiting(); e.waitUntil(caches.open(C).then(function(c){ return c.addAll(['./', 'icona.png', 'manifest.webmanifest']); }).catch(function(){})); });
self.addEventListener('activate', function(e){ e.waitUntil(caches.keys().then(function(k){ return Promise.all(k.filter(function(x){ return x !== C && x !== 'pannello-badge'; }).map(function(x){ return caches.delete(x); })); }).then(function(){ return self.clients.claim(); })); });
self.addEventListener('fetch', function(e){
  var r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(function(res){ if (res.ok) { var cp = res.clone(); caches.open(C).then(function(c){ c.put(r, cp); }); } return res; })
    .catch(function(){ return caches.match(r).then(function(m){ return m || caches.match('./'); }); }));
});
self.addEventListener('push', function(e){
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { testo: e.data ? e.data.text() : '' }; }
  var opz = { body: d.testo || '', icon: 'icona-192.png', badge: 'icona-192.png', data: { url: self.registration.scope } };
  if (d.tag) { opz.tag = d.tag; opz.renotify = true; }
  var badge = caches.open('pannello-badge').then(function(c){ return c.match('conteggio').then(function(r){ return r ? r.text() : '0'; }).then(function(t){ var n = (parseInt(t, 10) || 0) + 1; return c.put('conteggio', new Response(String(n))).then(function(){ if (self.navigator && self.navigator.setAppBadge) return self.navigator.setAppBadge(n); }); }); }).catch(function(){});
  e.waitUntil(Promise.all([self.registration.showNotification(d.titolo || 'Pannello hotel', opz), badge]));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(lista){
    for (var i = 0; i < lista.length; i++) { if (lista[i].url.indexOf(url) === 0 && 'focus' in lista[i]) { lista[i].postMessage({ tipo: 'aggiorna' }); return lista[i].focus(); } }
    return self.clients.openWindow(url);
  }));
});

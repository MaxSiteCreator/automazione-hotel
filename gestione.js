/* Pannello hotel - gestione: planning camere, listino, elenco camere, impostazioni, password */
(function(){
var API2 = 'https://macaruautomation.app.n8n.cloud/webhook/pannello-gestione';
var G = null, PL_DAL = null, GIORNI = 21, OCC_ID = 0;
var TIPI_OCC = { prenotazione: 'Prenotazione', amico: 'Amico o ospite del titolare', chiusa: 'Camera chiusa' };

function chiamaG(corpo, senzaAccesso){
  if (!senzaAccesso) { corpo.password = PWD; corpo.utente = UTENTE; }
  return fetch(API2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){
      if (r.status === 401) { var e = new Error('password'); e.auth = true; throw e; }
      if (!r.ok) { var e2 = new Error(j.errore || 'Non sono riuscito a salvare. Riprova.'); e2.msg = j.errore; throw e2; }
      return j;
    });
  });
}
window.chiamaG = function(c){ return chiamaG(c); };
function errore(e, dove){ if (e.auth) return mostraLogin('Sessione scaduta: inserisci di nuovo la password.'); var t = e.msg || 'Non sono riuscito a salvare. Controlla la connessione e riprova.'; if (dove) dove.textContent = t; else toast(t); }
function iso(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function piu(s, n){ var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function v(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }

window.caricaG = function(){
  return chiamaG({ azione: 'carica' }).then(function(d){ G = d; if (!PL_DAL) PL_DAL = iso(new Date()); disegnaPlanning(); disegnaListino(); disegnaCamere(); disegnaImpostazioni(); })
    .catch(function(e){ if (!e.auth) $('#pl-wrap').innerHTML = '<div class="empty">Non riesco a caricare il planning. Premi Aggiorna.</div>'; });
};

/* ---------- PLANNING ---------- */
function tipologie(){ return (G && G.config && G.config.tipologie) || []; }
function nomeTipo(c){ var t = tipologie().filter(function(x){ return x.codice === c; })[0]; return t ? t.nome : c; }
function occDi(cam, giorno){ return G.occupazioni.filter(function(o){ return String(o.camera) === String(cam) && o.dal <= giorno && giorno < o.al; })[0]; }
function disegnaPlanning(){
  if (!G) return;
  $('#pl-dal').value = PL_DAL;
  var sel = $('#pl-tipo'), cur = sel.value;
  sel.innerHTML = '<option value="">Tutte le camere</option>' + tipologie().map(function(t){ return '<option value="' + esc(t.codice) + '">' + esc(t.nome) + '</option>'; }).join('');
  sel.value = cur;
  var giorni = []; for (var i = 0; i < GIORNI; i++) giorni.push(piu(PL_DAL, i));
  var oggi = iso(new Date());
  var camere = G.camere.filter(function(c){ return !sel.value || c.tipologia === sel.value; });
  var attive = camere.filter(function(c){ return c.attiva; });
  var h = '<table class="pl"><thead><tr><th class="cam">Camera</th>' + giorni.map(function(g){ var d = new Date(g + 'T12:00:00'), we = d.getDay() === 0 || d.getDay() === 6; return '<th class="' + (we ? 'we ' : '') + (g === oggi ? 'oggi' : '') + '">' + d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 3) + '<br>' + d.getDate() + ' ' + d.toLocaleDateString('it-IT', { month: 'short' }) + '</th>'; }).join('') + '</tr></thead><tbody>';
  h += '<tr class="libere"><th class="cam">Libere</th>' + giorni.map(function(g){ var n = attive.filter(function(c){ return !occDi(c.numero, g); }).length; return '<td class="' + (n ? '' : 'zero') + '" title="Camere libere la notte del ' + g + '">' + n + '</td>'; }).join('') + '</tr>';
  camere.forEach(function(c){
    h += '<tr class="' + (c.attiva ? '' : 'off') + '"><th class="cam" scope="row"><b>' + esc(c.numero) + '</b><span>' + esc(nomeTipo(c.tipologia).split(' ')[0]) + '</span></th>';
    for (var i = 0; i < giorni.length; i++) {
      var g = giorni[i], o = occDi(c.numero, g);
      if (o) {
        var span = 1; while (i + span < giorni.length && giorni[i + span] < o.al) span++;
        h += '<td colspan="' + span + '"><button type="button" class="ob ob-' + esc(o.tipo) + '" data-occ="' + o.id + '" title="' + esc(o.nome + ' · dal ' + o.dal + ' al ' + o.al + (o.note ? ' · ' + o.note : '')) + '">' + esc(o.nome) + '</button></td>';
        i += span - 1;
      } else {
        var d = new Date(g + 'T12:00:00'), we = d.getDay() === 0 || d.getDay() === 6;
        h += '<td class="vuota' + (we ? ' we' : '') + '" data-cam="' + esc(c.numero) + '" data-g="' + g + '" title="Camera ' + esc(c.numero) + ' libera: tocca per bloccarla"></td>';
      }
    }
    h += '</tr>';
  });
  h += '</tbody></table>';
  $('#pl-wrap').innerHTML = camere.length ? h : '<div class="empty">Nessuna camera. Aggiungile in fondo a questa pagina.</div>';
}
$('#pl-dal').addEventListener('change', function(){ if (this.value) { PL_DAL = this.value; disegnaPlanning(); } });
$('#pl-prima').addEventListener('click', function(){ PL_DAL = piu(PL_DAL, -14); disegnaPlanning(); });
$('#pl-dopo').addEventListener('click', function(){ PL_DAL = piu(PL_DAL, 14); disegnaPlanning(); });
$('#pl-oggi').addEventListener('click', function(){ PL_DAL = iso(new Date()); disegnaPlanning(); });
$('#pl-tipo').addEventListener('change', disegnaPlanning);
$('#pl-nuova').addEventListener('click', function(){ apriOcc(null, '', PL_DAL); });
$('#pl-wrap').addEventListener('click', function(e){
  var b = e.target.closest('[data-occ]'); if (b) { var o = G.occupazioni.filter(function(x){ return x.id === Number(b.dataset.occ); })[0]; if (o) apriOcc(o); return; }
  var c = e.target.closest('td.vuota'); if (c) apriOcc(null, c.dataset.cam, c.dataset.g);
});

var dlg = $('#occ-dlg');
function apriOcc(o, cam, dal){
  OCC_ID = o ? o.id : 0;
  $('#occ-tit').textContent = o ? 'Camera ' + o.camera + ': modifica' : 'Blocca una camera';
  $('#occ-camera').innerHTML = G.camere.map(function(c){ return '<option value="' + esc(c.numero) + '">Camera ' + esc(c.numero) + ' · ' + esc(nomeTipo(c.tipologia)) + (c.attiva ? '' : ' (non in uso)') + '</option>'; }).join('');
  $('#occ-camera').value = o ? o.camera : (cam || (G.camere[0] && G.camere[0].numero) || '');
  $('#occ-dal').value = o ? o.dal : dal; $('#occ-al').value = o ? o.al : piu(dal, 7);
  $('#occ-tipo').value = o ? o.tipo : 'prenotazione'; $('#occ-nome').value = o ? o.nome : ''; $('#occ-note').value = o ? o.note : '';
  $('#occ-elimina').hidden = !o; $('#occ-err').textContent = '';
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}
function chiudiDlg(){ if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
$('#occ-chiudi').addEventListener('click', chiudiDlg);
$('#occ-salva').addEventListener('click', function(){
  var o = { id: OCC_ID, camera: v('occ-camera'), dal: v('occ-dal'), al: v('occ-al'), tipo: v('occ-tipo'), nome: v('occ-nome'), note: v('occ-note') };
  if (!o.dal || !o.al || o.al <= o.dal) { $('#occ-err').textContent = 'La partenza deve essere dopo l\'arrivo.'; return; }
  var conflitto = G.occupazioni.filter(function(x){ return x.id !== OCC_ID && String(x.camera) === String(o.camera) && x.dal < o.al && o.dal < x.al; })[0];
  if (conflitto) { $('#occ-err').textContent = 'La camera ' + o.camera + ' è già occupata da ' + conflitto.nome + ' (dal ' + gg(conflitto.dal) + ' al ' + gg(conflitto.al) + '). Scegli un\'altra camera o altre date.'; return; }
  if (!o.nome) o.nome = TIPI_OCC[o.tipo];
  var b = this; b.disabled = true;
  chiamaG({ azione: 'salva_occ', occ: o }).then(function(){ chiudiDlg(); toast('Camera ' + o.camera + ' bloccata dal ' + gg(o.dal) + ' al ' + gg(o.al) + '.'); return caricaG(); })
    .catch(function(e){ errore(e, $('#occ-err')); }).then(function(){ b.disabled = false; });
});
$('#occ-elimina').addEventListener('click', function(){
  var b = this; b.disabled = true;
  chiamaG({ azione: 'elimina_occ', id: OCC_ID }).then(function(){ chiudiDlg(); toast('Camera liberata.'); return caricaG(); })
    .catch(function(e){ errore(e, $('#occ-err')); }).then(function(){ b.disabled = false; });
});

/* ---------- LISTINO ---------- */
var LS = null;
function mmgg(s){ return s ? String(s).slice(5) : ''; }
function annoStag(){ return String((G.config.stagione && G.config.stagione.apertura) || iso(new Date())).slice(0, 4); }
function disegnaListino(){
  if (!G) return;
  LS = clone(G.config.listino || { periodi: [], trattamenti: { BB: -12, HB: 0, FB: 12 }, bambini: [], speciali: [] });
  LS.speciali = LS.speciali || []; LS.bambini = LS.bambini || []; LS.trattamenti = LS.trattamenti || { BB: -12, HB: 0, FB: 12 };
  var A = annoStag();
  $('#ls-periodi').innerHTML = '<thead><tr><th>Nome</th><th>Dal</th><th>Al</th><th>€ a persona</th><th>Minimo notti</th><th></th></tr></thead><tbody>' + LS.periodi.map(function(p, i){
    return '<tr><td><input data-ls="periodi" data-i="' + i + '" data-k="nome" value="' + esc(p.nome) + '"></td><td><input type="date" data-ls="periodi" data-i="' + i + '" data-k="dal" value="' + A + '-' + esc(p.dal) + '"></td><td><input type="date" data-ls="periodi" data-i="' + i + '" data-k="al" value="' + A + '-' + esc(p.al) + '"></td><td><input class="n" type="number" min="0" step="1" data-ls="periodi" data-i="' + i + '" data-k="prezzo" value="' + esc(p.prezzo) + '"></td><td><input class="n" type="number" min="0" step="1" data-ls="periodi" data-i="' + i + '" data-k="minimo_notti" value="' + esc(p.minimo_notti || '') + '" placeholder="—"></td><td class="x"><button class="xbtn" type="button" data-del="periodi" data-i="' + i + '" aria-label="Togli periodo">×</button></td></tr>';
  }).join('') + '</tbody>';
  $('#ls-speciali').innerHTML = LS.speciali.length ? '<thead><tr><th>Dal</th><th>Al (compreso)</th><th>€ a persona</th><th>Motivo</th><th></th></tr></thead><tbody>' + LS.speciali.map(function(p, i){
    return '<tr><td><input type="date" data-ls="speciali" data-i="' + i + '" data-k="dal" value="' + esc(p.dal) + '"></td><td><input type="date" data-ls="speciali" data-i="' + i + '" data-k="al" value="' + esc(p.al) + '"></td><td><input class="n" type="number" min="0" data-ls="speciali" data-i="' + i + '" data-k="prezzo" value="' + esc(p.prezzo) + '"></td><td><input data-ls="speciali" data-i="' + i + '" data-k="nota" value="' + esc(p.nota || '') + '" placeholder="Es. Notte Rosa"></td><td class="x"><button class="xbtn" type="button" data-del="speciali" data-i="' + i + '" aria-label="Togli">×</button></td></tr>';
  }).join('') + '</tbody>' : '<tbody><tr><td class="note">Nessun prezzo speciale.</td></tr></tbody>';
  $('#ls-tratt').innerHTML = [['BB', 'Pernottamento e colazione'], ['FB', 'Pensione completa']].map(function(t){ return '<label for="tr-' + t[0] + '">' + t[1] + '</label><input id="tr-' + t[0] + '" type="number" step="1" data-tr="' + t[0] + '" value="' + esc(LS.trattamenti[t[0]] || 0) + '">'; }).join('');
  $('#ls-bambini').innerHTML = '<thead><tr><th>Fino a anni</th><th>Sconto %</th><th></th></tr></thead><tbody>' + LS.bambini.map(function(b, i){
    return '<tr><td><input class="n" type="number" min="0" max="17" data-ls="bambini" data-i="' + i + '" data-k="fino_a" value="' + esc(b.fino_a) + '"></td><td><input class="n" type="number" min="0" max="100" data-ls="bambini" data-i="' + i + '" data-k="sconto" value="' + esc(b.sconto) + '"></td><td class="x"><button class="xbtn" type="button" data-del="bambini" data-i="' + i + '" aria-label="Togli">×</button></td></tr>';
  }).join('') + '</tbody>';
  $('#ls-stato').textContent = '';
}
document.addEventListener('input', function(e){
  var t = e.target;
  if (t.dataset && t.dataset.ls && LS) {
    var arr = LS[t.dataset.ls], row = arr[Number(t.dataset.i)], k = t.dataset.k, val = t.value;
    if (t.type === 'number') val = val === '' ? (k === 'minimo_notti' ? undefined : 0) : Number(val);
    if (t.dataset.ls === 'periodi' && (k === 'dal' || k === 'al')) val = mmgg(val);
    if (val === undefined) delete row[k]; else row[k] = val;
    $('#ls-stato').textContent = 'Modifiche non salvate';
  }
  if (t.dataset && t.dataset.tr && LS) { LS.trattamenti[t.dataset.tr] = Number(t.value) || 0; $('#ls-stato').textContent = 'Modifiche non salvate'; }
});
document.addEventListener('click', function(e){
  var d = e.target.closest('[data-del]'); if (!d || !LS) return;
  LS[d.dataset.del].splice(Number(d.dataset.i), 1); var keep = clone(LS); disegnaListinoDa(keep);
});
function disegnaListinoDa(ls){ var old = G.config.listino; G.config.listino = ls; disegnaListino(); G.config.listino = old; $('#ls-stato').textContent = 'Modifiche non salvate'; }
$('#ls-add-periodo').addEventListener('click', function(){ var k = clone(LS); var last = k.periodi[k.periodi.length - 1]; k.periodi.push({ nome: 'Nuovo periodo', dal: last ? last.al : '06-01', al: last ? last.al : '06-30', prezzo: last ? last.prezzo : 60 }); disegnaListinoDa(k); });
$('#ls-add-speciale').addEventListener('click', function(){ var k = clone(LS); var d = iso(new Date()); k.speciali.push({ dal: d, al: d, prezzo: 0, nota: '' }); disegnaListinoDa(k); });
$('#ls-salva').addEventListener('click', function(){
  var errs = [];
  LS.periodi.forEach(function(p){ if (!p.nome || !/^\d{2}-\d{2}$/.test(p.dal) || !/^\d{2}-\d{2}$/.test(p.al) || p.al < p.dal) errs.push('controlla le date del periodo "' + (p.nome || '?') + '"'); if (!(p.prezzo > 0)) errs.push('manca il prezzo di "' + (p.nome || '?') + '"'); });
  var ord = LS.periodi.slice().sort(function(a, b){ return a.dal.localeCompare(b.dal); });
  for (var i = 1; i < ord.length; i++) if (ord[i].dal <= ord[i - 1].al) errs.push('"' + ord[i - 1].nome + '" e "' + ord[i].nome + '" si sovrappongono');
  LS.speciali.forEach(function(p){ if (!p.dal || !p.al || p.al < p.dal || !(p.prezzo > 0)) errs.push('controlla date e prezzo dei prezzi speciali'); });
  if (errs.length) { $('#ls-stato').textContent = 'Da sistemare: ' + errs.filter(function(x, i, a){ return a.indexOf(x) === i; }).join('; ') + '.'; return; }
  LS.periodi = ord; LS.bambini.sort(function(a, b){ return a.fino_a - b.fino_a; });
  var cfg = clone(G.config); cfg.listino = LS;
  salvaConfig(cfg, this, $('#ls-stato'), 'Listino salvato: i prossimi preventivi usano i nuovi prezzi.');
});
function salvaConfig(cfg, b, stato, ok){
  b.disabled = true; stato.textContent = 'Salvataggio…';
  chiamaG({ azione: 'salva_config', dati: cfg }).then(function(){ G.config = cfg; stato.textContent = ''; toast(ok); return caricaG(); })
    .catch(function(e){ errore(e, stato); }).then(function(){ b.disabled = false; });
}

/* ---------- ELENCO CAMERE ---------- */
function disegnaCamere(){
  if (!G) return;
  var opt = function(sel){ return tipologie().map(function(t){ return '<option value="' + esc(t.codice) + '"' + (t.codice === sel ? ' selected' : '') + '>' + esc(t.nome) + '</option>'; }).join(''); };
  $('#cm-lista').innerHTML = '<thead><tr><th>N°</th><th>Tipologia</th><th>Piano</th><th>Note</th><th>In uso</th><th></th></tr></thead><tbody>' + G.camere.map(function(c){
    return '<tr data-cm="' + c.id + '"><td><input class="n" data-f="numero" value="' + esc(c.numero) + '" aria-label="Numero"></td><td><select data-f="tipologia" aria-label="Tipologia">' + opt(c.tipologia) + '</select></td><td><input class="n" data-f="piano" value="' + esc(c.piano) + '" aria-label="Piano"></td><td><input data-f="note" value="' + esc(c.note) + '" placeholder="Es. vista mare frontale" aria-label="Note"></td><td><input type="checkbox" data-f="attiva"' + (c.attiva ? ' checked' : '') + ' aria-label="In uso"></td><td class="x"><button class="btn" type="button" data-cm-salva hidden>Salva</button><button class="xbtn" type="button" data-cm-del aria-label="Elimina camera">×</button></td></tr>';
  }).join('') + '</tbody>';
}
$('#cm-lista').addEventListener('input', function(e){ var tr = e.target.closest('tr'); if (tr) tr.querySelector('[data-cm-salva]').hidden = false; });
$('#cm-lista').addEventListener('change', function(e){ var tr = e.target.closest('tr'); if (tr) tr.querySelector('[data-cm-salva]').hidden = false; });
$('#cm-lista').addEventListener('click', function(e){
  var tr = e.target.closest('tr'); if (!tr) return;
  var id = Number(tr.dataset.cm) || 0, b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-cm-salva')) {
    var c = { id: id, numero: tr.querySelector('[data-f=numero]').value.trim(), tipologia: tr.querySelector('[data-f=tipologia]').value, piano: tr.querySelector('[data-f=piano]').value.trim(), note: tr.querySelector('[data-f=note]').value.trim(), attiva: tr.querySelector('[data-f=attiva]').checked };
    if (!c.numero) return toast('Scrivi il numero della camera.');
    if (G.camere.some(function(x){ return x.id !== id && String(x.numero) === c.numero; })) return toast('Esiste già una camera ' + c.numero + '.');
    b.disabled = true;
    chiamaG({ azione: 'salva_camera', camera: c }).then(function(){ toast('Camera ' + c.numero + ' salvata.'); return caricaG(); }).catch(function(e){ errore(e); b.disabled = false; });
  }
  if (b.hasAttribute('data-cm-del')) {
    var cam = G.camere.filter(function(x){ return x.id === id; })[0];
    if (!id) { tr.remove(); return; }
    var future = G.occupazioni.filter(function(o){ return String(o.camera) === String(cam.numero) && o.al >= iso(new Date()); }).length;
    if (future) return toast('La camera ' + cam.numero + ' ha ' + future + ' occupazioni in programma: liberala nel planning o togli la spunta "In uso".');
    b.disabled = true;
    chiamaG({ azione: 'elimina_camera', id: id }).then(function(){ toast('Camera ' + cam.numero + ' eliminata.'); return caricaG(); }).catch(function(e){ errore(e); b.disabled = false; });
  }
});
$('#cm-add').addEventListener('click', function(){
  var max = G.camere.reduce(function(m, c){ return Math.max(m, parseInt(c.numero, 10) || 0); }, 0);
  G.camere.push({ id: 0, numero: String(max + 1), tipologia: (tipologie()[0] || {}).codice || '', piano: '', note: '', attiva: true });
  disegnaCamere(); var rows = $('#cm-lista').querySelectorAll('tr[data-cm]'); var last = rows[rows.length - 1]; last.querySelector('[data-cm-salva]').hidden = false; last.querySelector('input').focus();
  G.camere.pop();
});

/* ---------- IMPOSTAZIONI ---------- */
var SEZIONI = [
  { t: 'L\'hotel', k: 'hotel', campi: [['nome', 'Come si chiama l\'hotel?'], ['stelle', 'Quante stelle ha?', 'number'], ['indirizzo', 'Indirizzo completo'], ['zona', 'In che zona si trova?', '', 'Es. Marina Centro, vicino al Grand Hotel'], ['telefono', 'Telefono della reception'], ['email_reception', 'Email della reception (qui arrivano gli avvisi)', 'email'], ['whatsapp', 'Numero WhatsApp per i clienti'], ['sito', 'Sito internet'], ['link_recensioni', 'Link per lasciare una recensione su Google', '', 'Si trova nella scheda Google dell\'hotel: Chiedi recensioni > copia link'], ['gestione', 'Da chi è gestito?', '', 'Es. familiare dal 1978'], ['descrizione', 'Descrivi l\'hotel in due righe, come lo diresti a un cliente', 'area']] },
  { t: 'La stagione', k: 'stagione', campi: [['apertura', 'Quando apre?', 'date'], ['chiusura', 'Quando chiude (ultima notte)?', 'date']] },
  { t: 'Orari', k: 'orari', campi: [['checkin', 'Da che ora si può fare il check-in?'], ['checkout', 'Entro che ora il check-out?'], ['colazione', 'Colazione: orari e com\'è', '', 'Es. 7:30-10:00 a buffet'], ['cena', 'Cena: orari e com\'è'], ['reception', 'Orari della reception']] },
  { t: 'Servizi', k: 'servizi', campi: [['distanza_mare', 'Quanto dista dal mare?'], ['spiaggia', 'Spiaggia: cosa è incluso?'], ['parcheggio', 'Parcheggio: c\'è? quanto costa?'], ['animali', 'Animali: sono ammessi? a che condizioni?'], ['bambini', 'Servizi per i bambini (miniclub, culla, seggiolone)'], ['biciclette', 'Biciclette'], ['wifi', 'Wifi'], ['ascensore', 'C\'è l\'ascensore?'], ['diete', 'Diete particolari (vegetariano, senza glutine)'], ['altro', 'Altro da sapere sulle camere e sull\'hotel', 'area']] },
  { t: 'Condizioni di prenotazione', k: 'condizioni', campi: [['caparra', 'Caparra per confermare (%)', 'number'], ['cancellazione_giorni', 'Cancellazione gratuita fino a quanti giorni prima dell\'arrivo?', 'number'], ['pagamenti', 'Come si paga la caparra?', '', 'Es. bonifico o carta'], ['tassa_soggiorno', 'Tassa di soggiorno'], ['prenota_prima_percento', 'Sconto "prenota prima" (%), 0 se non c\'è', 'number'], ['prenota_prima_entro', 'Lo sconto "prenota prima" vale fino al', 'date']] },
  { t: 'Messaggi agli ospiti', k: 'messaggi', nota: 'Scrivete in italiano cosa volete dire, con parole vostre. Il sistema lo adatta a ogni ospite (saluto per nome, lei o voi) e lo traduce nella sua lingua. Non aggiunge mai prezzi, sconti o servizi che non avete scritto voi.', campi: [['firma', 'Come firmate le email?', '', 'Es. La famiglia dell\'Hotel Mare Blu'], ['benvenuto', '3 giorni prima dell\'arrivo: cosa volete ricordare all\'ospite?', 'area', 'Es. orario del check-in, parcheggio da prenotare, spiaggia inclusa, orario della cena'], ['secondo_giorno', 'Il giorno dopo l\'arrivo: come chiedete se va tutto bene?', 'area', 'Sotto il messaggio aggiungiamo noi i pulsanti Tutto perfetto / C\'è qualcosa da sistemare'], ['sollecito', 'Preventivo senza risposta da 2 giorni: cosa scrivete?', 'area', 'Sotto aggiungiamo noi il pulsante Blocca la camera'], ['recensione', 'Il giorno dopo la partenza: come chiedete un voto?', 'area', 'Sotto aggiungiamo noi le 5 stelle da cliccare'], ['ritorno', 'A gennaio, agli ospiti degli anni passati: cosa offrite a chi torna?', 'area', 'Es. sconto del 10% prenotando entro il 31 gennaio e parcheggio gratuito']] },
  { t: 'Assistente virtuale', k: 'assistente', campi: [['nome', 'Che nome ha l\'assistente?'], ['tono', 'Che tono deve usare con i clienti?', '', 'Es. caldo, familiare e cortese, sempre dando del Lei'], ['regole', 'Regole da rispettare sempre', 'area', 'Es. non confermare mai una prenotazione, non offrire sconti non previsti']] }
];
var CF = null;
function campoHtml(sez, c, val){
  var id = 'cf-' + sez + '-' + c[0], tipo = c[2] || 'text';
  var input = tipo === 'area' ? '<textarea id="' + id + '" data-cf="' + sez + '" data-k="' + c[0] + '" placeholder="' + esc(c[3] || '') + '">' + esc(val) + '</textarea>'
    : '<input id="' + id + '" type="' + tipo + '" data-cf="' + sez + '" data-k="' + c[0] + '" value="' + esc(val) + '" placeholder="' + esc(c[3] || '') + '">';
  return '<div class="campo"' + (tipo === 'area' ? ' style="grid-column:1/-1"' : '') + '><label for="' + id + '">' + esc(c[1]) + '</label>' + input + '</div>';
}
function disegnaImpostazioni(){
  if (!G) return;
  CF = clone(G.config || {});
  var h = SEZIONI.map(function(s){ var o = CF[s.k] || {}; return '<div class="sez"><h3>' + esc(s.t) + '</h3>' + (s.nota ? '<p class="note">' + esc(s.nota) + '</p>' : '') + '<div class="griglia">' + s.campi.map(function(c){ return campoHtml(s.k, c, o[c[0]] == null ? '' : o[c[0]]); }).join('') + '</div></div>'; }).join('');
  h += '<div class="sez"><h3>Tipologie di camera</h3><p class="note">Il codice serve all\'assistente e alle foto (es. doppia, tripla). Il supplemento è in euro a persona a notte, 0 se non c\'è.</p><div id="cf-tip">' + (CF.tipologie || []).map(function(t, i){
    return '<div class="rip" style="margin-bottom:10px"><button class="xbtn" type="button" data-cf-del="tipologie" data-i="' + i + '" aria-label="Togli tipologia">×</button>' + [['codice', 'Codice'], ['nome', 'Nome per i clienti'], ['posti', 'Posti letto', 'number'], ['supplemento', 'Supplemento €', 'number'], ['descrizione', 'Descrizione']].map(function(f){ return '<div class="campo"' + (f[0] === 'descrizione' ? ' style="grid-column:1/-1"' : '') + '><label>' + f[1] + '</label><input type="' + (f[2] || 'text') + '" data-cf-arr="tipologie" data-i="' + i + '" data-k="' + f[0] + '" value="' + esc(t[f[0]] == null ? '' : t[f[0]]) + '"></div>'; }).join('') + '</div>';
  }).join('') + '</div><div><button class="btn" type="button" data-cf-add="tipologie">+ Aggiungi tipologia</button></div></div>';
  h += '<div class="sez"><h3>Extra prenotabili</h3><p class="note">Compaiono nell\'email di benvenuto tre giorni prima dell\'arrivo: l\'ospite li prenota con un tocco.</p><div>' + (CF.extra || []).map(function(x, i){
    return '<div class="rip" style="margin-bottom:10px"><button class="xbtn" type="button" data-cf-del="extra" data-i="' + i + '" aria-label="Togli extra">×</button><div class="campo"><label>Nome</label><input data-cf-arr="extra" data-i="' + i + '" data-k="nome" value="' + esc(x.nome) + '"></div><div class="campo"><label>Prezzo €</label><input type="number" data-cf-arr="extra" data-i="' + i + '" data-k="prezzo" value="' + esc(x.prezzo) + '"></div><div class="campo"><label>A</label><select data-cf-arr="extra" data-i="' + i + '" data-k="per">' + ['notte', 'persona', 'tratta', 'soggiorno'].map(function(p){ return '<option' + (x.per === p ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></div></div>';
  }).join('') + '</div><div><button class="btn" type="button" data-cf-add="extra">+ Aggiungi extra</button></div></div>';
  $('#cf-form').innerHTML = h;
  $('#cf-stato').textContent = '';
  $('#ac-email').value = G.email || '';
}
function cfSegna(){ $('#cf-stato').textContent = 'Modifiche non salvate'; }
$('#cf-form').addEventListener('input', function(e){
  var t = e.target, val = t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value;
  if (t.dataset.cf) { CF[t.dataset.cf] = CF[t.dataset.cf] || {}; CF[t.dataset.cf][t.dataset.k] = val; cfSegna(); }
  if (t.dataset.cfArr) { CF[t.dataset.cfArr][Number(t.dataset.i)][t.dataset.k] = val; cfSegna(); }
});
$('#cf-form').addEventListener('change', function(e){ var t = e.target; if (t.tagName === 'SELECT' && t.dataset.cfArr) { CF[t.dataset.cfArr][Number(t.dataset.i)][t.dataset.k] = t.value; cfSegna(); } });
$('#cf-form').addEventListener('click', function(e){
  var d = e.target.closest('[data-cf-del]'), a = e.target.closest('[data-cf-add]');
  if (!d && !a) return;
  var keep = clone(CF);
  if (d) keep[d.dataset.cfDel].splice(Number(d.dataset.i), 1);
  if (a && a.dataset.cfAdd === 'tipologie') (keep.tipologie = keep.tipologie || []).push({ codice: '', nome: '', posti: 2, descrizione: '', supplemento: 0 });
  if (a && a.dataset.cfAdd === 'extra') (keep.extra = keep.extra || []).push({ nome: '', prezzo: 0, per: 'soggiorno' });
  var old = G.config; G.config = keep; disegnaImpostazioni(); G.config = old; cfSegna();
});
function slug(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30); }
$('#cf-salva').addEventListener('click', function(){
  var errs = [];
  if (!CF.hotel || !CF.hotel.nome) errs.push('il nome dell\'hotel');
  (CF.tipologie || []).forEach(function(t){ t.codice = slug(t.codice || t.nome); t.posti = Number(t.posti) || 0; t.supplemento = Number(t.supplemento) || 0; if (!t.codice || !t.nome || !t.posti) errs.push('nome e posti di ogni tipologia'); });
  (CF.extra || []).forEach(function(x){ x.codice = x.codice || slug(x.nome); x.prezzo = Number(x.prezzo) || 0; if (!x.nome) errs.push('il nome di ogni extra'); });
  if (!(CF.tipologie || []).length) errs.push('almeno una tipologia di camera');
  if (errs.length) { $('#cf-stato').textContent = 'Manca: ' + errs.filter(function(x, i, a){ return a.indexOf(x) === i; }).join(', ') + '.'; return; }
  var cfg = clone(CF); cfg.listino = G.config.listino;
  salvaConfig(cfg, this, $('#cf-stato'), 'Impostazioni salvate: l\'assistente le usa da subito.');
});

/* ---------- ACCOUNT ---------- */
$('#ac-email-salva').addEventListener('click', function(){
  var b = this; b.disabled = true;
  chiamaG({ azione: 'salva_email', email: $('#ac-email').value.trim() }).then(function(){ toast('Email salvata: la userai per recuperare la password.'); }).catch(function(e){ errore(e, $('#ac-msg')); }).then(function(){ b.disabled = false; });
});
$('#ac-pwd').addEventListener('click', function(){
  var n = $('#ac-nuova').value, r = $('#ac-ripeti').value;
  if (n.length < 8) { $('#ac-msg').textContent = 'Almeno 8 caratteri.'; return; }
  if (n !== r) { $('#ac-msg').textContent = 'Le due password non coincidono.'; return; }
  var b = this; b.disabled = true;
  chiamaG({ azione: 'password', nuova: n }).then(function(){ PWD = n; salvaAccesso(true); $('#ac-nuova').value = ''; $('#ac-ripeti').value = ''; $('#ac-msg').textContent = ''; toast('Password cambiata.'); })
    .catch(function(e){ errore(e, $('#ac-msg')); }).then(function(){ b.disabled = false; });
});

/* ---------- PASSWORD DIMENTICATA ---------- */
$('#b-dimenticata').addEventListener('click', function(){ $('#f-login').hidden = true; $('#f-dimenticata').hidden = false; $('#d-utente').value = $('#utente').value; $('#d-utente').focus(); });
$('#b-dim-torna').addEventListener('click', function(){ $('#f-dimenticata').hidden = true; $('#f-login').hidden = false; });
$('#f-dimenticata').addEventListener('submit', function(e){
  e.preventDefault(); var b = $('#b-dim-invia'); b.disabled = true;
  chiamaG({ azione: 'reset_richiesta', utente: v('d-utente') }, true).then(function(){ $('#d-msg').style.color = 'var(--good)'; $('#d-msg').textContent = 'Se l\'account esiste e ha un\'email, ti abbiamo mandato il link. Controlla anche lo spam.'; })
    .catch(function(){ $('#d-msg').textContent = 'Non riesco a mandare la richiesta. Riprova tra poco.'; }).then(function(){ b.disabled = false; });
});
$('#f-reset').addEventListener('submit', function(e){
  e.preventDefault();
  var n = $('#r-nuova').value, r = $('#r-ripeti').value;
  if (n.length < 8) { $('#r-msg').textContent = 'Almeno 8 caratteri.'; return; }
  if (n !== r) { $('#r-msg').textContent = 'Le due password non coincidono.'; return; }
  var b = $('#b-reset'); b.disabled = true;
  var token = new URLSearchParams(location.search).get('reset') || '';
  chiamaG({ azione: 'reset_conferma', token: token, nuova: n }, true).then(function(){
    try { history.replaceState(null, '', location.pathname); } catch (x) {}
    $('#f-reset').hidden = true; $('#f-login').hidden = false; $('#err').style.color = 'var(--good)'; $('#err').textContent = 'Password aggiornata: ora puoi entrare.'; $('#pwd').focus();
    var uu = $('#utente').value.trim().toLowerCase();
    if (uu && new URLSearchParams(location.search).get('nuovo') !== '0') { UTENTE = uu; PWD = n; $('#pwd').value = n; carica().then(function(){ if (D) salvaAccesso(true); }); }
  }).catch(function(e2){ $('#r-msg').textContent = e2.msg || 'Non sono riuscito a salvare. Riprova.'; }).then(function(){ b.disabled = false; });
});

/* ---------- CONCORRENTI (scelti dal titolare) ---------- */
(function(){
var CONC = null, MAX = 8, toccato = false;
function stato(t, ok){ var el = $('#conc-stato'); if (el) { el.textContent = t || ''; el.style.color = ok ? 'var(--good)' : ''; } }
function disegna(){
  var box = $('#conc-lista'); if (!box) return;
  if (!CONC) { box.innerHTML = '<div class="empty">Caricamento…</div>'; return; }
  box.innerHTML = CONC.length ? CONC.map(function(n, i){ return '<span class="conc-c">' + esc(n) + '<button type="button" data-i="' + i + '" aria-label="Togli ' + esc(n) + '">✕</button></span>'; }).join('')
    : '<div class="empty" style="width:100%">Nessun hotel scelto: cercane uno qui sotto.</div>';
  $('#conc-cerca').disabled = CONC.length >= MAX;
  if (CONC.length >= MAX) stato('Hai già scelto ' + MAX + ' hotel: togline uno per aggiungerne un altro.');
}
function aggiungi(n){
  n = String(n || '').trim(); if (!n || !CONC) return;
  if (CONC.some(function(x){ return x.toLowerCase() === n.toLowerCase(); })) return stato(n + ' è già nella lista.');
  if (CONC.length >= MAX) return stato('Massimo ' + MAX + ' hotel.');
  CONC.push(n); toccato = true; disegna(); stato('Modifiche da salvare.'); mostraRis(ULTIMI);
}
var ULTIMI = null;
function mostraRis(r){
  var box = $('#conc-ris'); if (!box) return; ULTIMI = r;
  if (!r) { box.innerHTML = ''; return; }
  var q = $('#conc-q').value.trim();
  var gia = function(n){ return CONC.some(function(x){ return x.toLowerCase() === String(n).toLowerCase(); }); };
  var data = r.data ? new Date(r.data + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : '';
  var righe = (r.risultati || []).map(function(h){
    var info = [];
    if (h.stelle) info.push(h.stelle + ' stelle');
    if (h.voto) info.push('★ ' + String(h.voto).replace('.', ',') + (h.recensioni ? ' (' + h.recensioni + ' recensioni)' : ''));
    info.push(h.prezzo ? 'da ' + h.prezzo + ' € a notte il ' + data : 'prezzo non ancora pubblicato');
    return '<div class="conc-r"><div class="i"><b>' + esc(h.nome) + '</b><span>' + esc(info.join(' · ')) + '</span></div>'
      + (gia(h.nome) ? '<span class="chip">Aggiunto</span>' : '<button class="btn" type="button" data-agg="' + esc(h.nome) + '">+ Aggiungi</button>') + '</div>';
  }).join('');
  if (r.errore) righe = '<p class="note">' + esc(r.errore) + '</p>';
  if (q && !gia(q)) righe += '<p class="note" style="margin-bottom:0">Non è nella lista? <button class="btn" type="button" data-agg="' + esc(q) + '">Aggiungi "' + esc(q) + '" così com\'è</button></p>';
  box.innerHTML = righe;
}
function cerca(){
  var q = $('#conc-q').value.trim(), b = $('#conc-cerca');
  if (q.length < 3) return stato('Scrivi almeno 3 lettere del nome.');
  b.disabled = true; stato(''); $('#conc-ris').innerHTML = '<p class="note">Cerco su Google Hotels…</p>';
  chiamaG({ azione: 'cerca_hotel', q: q }).then(mostraRis).catch(function(e){ $('#conc-ris').innerHTML = ''; errore(e, $('#conc-stato')); }).then(function(){ b.disabled = CONC && CONC.length >= MAX; });
}
document.addEventListener('click', function(e){
  var t = e.target;
  if (t.closest && t.closest('.conc-c button')) { var i = Number(t.closest('button').dataset.i); CONC.splice(i, 1); toccato = true; disegna(); stato('Modifiche da salvare.'); mostraRis(ULTIMI); return; }
  if (t.dataset && t.dataset.agg) { aggiungi(t.dataset.agg); return; }
  if (t.id === 'conc-cerca') cerca();
  if (t.id === 'conc-salva') {
    if (!CONC) return;
    if (CONC.length < 2) return stato('Scegli almeno 2 hotel: con meno il confronto non è affidabile.');
    t.disabled = true;
    chiamaG({ azione: 'salva_concorrenti', concorrenti: CONC }).then(function(){ toccato = false; stato('Salvato. I prezzi dei nuovi hotel arrivano lunedì mattina.', true); })
      .catch(function(e2){ errore(e2, $('#conc-stato')); }).then(function(){ t.disabled = false; });
  }
});
document.addEventListener('keydown', function(e){ if (e.target && e.target.id === 'conc-q' && e.key === 'Enter') { e.preventDefault(); cerca(); } });
var prima = window.caricaG;
window.caricaG = function(){
  return Promise.resolve(prima()).then(function(){ if (G && !toccato) { CONC = (G.concorrenti || []).slice(); disegna(); } });
};
})();


/* ---------- INVITO: benvenuto nella pagina della password ---------- */
(function(){
  var q = new URLSearchParams(location.search);
  if (!q.get('reset') || q.get('nuovo') !== '1') return;
  var f = $('#f-reset'); if (!f) return;
  var h = f.querySelector('h1'), n = f.querySelector('p.note');
  var hotel = (q.get('h') || '').slice(0, 80);
  if (h) h.textContent = 'Benvenuto!';
  if (n) n.textContent = 'Scegli la password per entrare nel pannello' + (hotel ? ' di ' + hotel : '') + '. Almeno 8 caratteri: il Portachiavi dell’iPhone può suggerirne e ricordarne una sicura.';
  var u = (q.get('u') || '').slice(0, 60);
  if (u) { var iu = $('#utente'); if (iu) iu.value = u; }
  var b = $('#b-reset'); if (b) b.textContent = 'Crea la password ed entra';
})();

/* ---------- AMMINISTRATORE: crea un nuovo hotel e invita il titolare ---------- */
function slug(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^hotel\s+/, '').replace(/[^a-z0-9]+/g, '').slice(0, 24); }
function disegnaAdmin(){
  var box = $('#adm-card');
  if (!G || !G.admin) { if (box) box.remove(); return; }
  if (box) return;
  box = document.createElement('div'); box.className = 'card'; box.id = 'adm-card';
  box.innerHTML = '<h3>Nuovo hotel cliente <span class="chip">solo amministratore</span></h3>'
    + '<p class="note" style="margin-top:0">Crea l’accesso per un nuovo hotel: il titolare riceve un’email per scegliere la password (il link vale 7 giorni) e al primo accesso il pannello lo guida a compilare tutto.</p>'
    + '<div class="griglia"><div class="campo"><label for="adm-nome">Nome dell’hotel</label><input id="adm-nome" placeholder="Es. Hotel Sole"></div>'
    + '<div class="campo"><label for="adm-utente">Nome utente per entrare</label><input id="adm-utente" autocapitalize="none" spellcheck="false" placeholder="Es. sole"></div>'
    + '<div class="campo"><label for="adm-email">Email del titolare</label><input id="adm-email" type="email" placeholder="nome@esempio.it"></div></div>'
    + '<div class="riga" style="margin-top:10px"><button class="btn primary" type="button" id="adm-crea">Crea e manda l’invito</button><span class="note" id="adm-stato"></span></div>';
  $('#s-impost').appendChild(box);
  var toccatoU = false;
  $('#adm-nome').addEventListener('input', function(){ if (!toccatoU) $('#adm-utente').value = slug(this.value); });
  $('#adm-utente').addEventListener('input', function(){ toccatoU = true; });
  $('#adm-crea').addEventListener('click', function(){
    var b = this, st = $('#adm-stato');
    var nome = $('#adm-nome').value.trim(), ut = $('#adm-utente').value.trim().toLowerCase(), em = $('#adm-email').value.trim();
    if (nome.length < 2) { st.textContent = 'Scrivi il nome dell’hotel.'; return; }
    if (!/^[a-z0-9][a-z0-9.-]{2,30}$/.test(ut)) { st.textContent = 'Nome utente: almeno 3 caratteri, solo lettere minuscole, numeri, punto o trattino.'; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { st.textContent = 'Email non valida.'; return; }
    b.disabled = true; st.style.color = ''; st.textContent = 'Creo l’accesso…';
    chiamaG({ azione: 'crea_hotel', nome: nome, nuovo_utente: ut, email: em }).then(function(){
      st.style.color = 'var(--good)'; st.textContent = 'Fatto: invito mandato a ' + em + '. Nome utente: ' + ut + '.';
      $('#adm-nome').value = ''; $('#adm-utente').value = ''; $('#adm-email').value = ''; toccatoU = false;
    }).catch(function(e){ st.style.color = ''; errore(e, st); }).then(function(){ b.disabled = false; });
  });
}

/* ---------- PROCEDURA GUIDATA al primo accesso ---------- */
var WZ = { passo: 0, aperta: false };
var PASSI_WZ = ['intro', 'hotel', 'stagione', 'orari', 'servizi', 'condizioni', 'messaggi', 'assistente', 'fine'];
function sezione(k){ return SEZIONI.filter(function(s){ return s.k === k; })[0]; }
function disegnaWizard(){
  var w = $('#wizard');
  if (!w) { w = document.createElement('div'); w.id = 'wizard'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'wz-tit'); document.body.appendChild(w);
    w.addEventListener('input', function(e){ var t = e.target; if (!t.dataset.cf) return; var val = t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value; CF[t.dataset.cf] = CF[t.dataset.cf] || {}; CF[t.dataset.cf][t.dataset.k] = val; });
    w.addEventListener('click', function(e){ var t = e.target.closest('button'); if (!t) return; if (t.id === 'wz-avanti') avantiWz(1); if (t.id === 'wz-indietro') avantiWz(-1); if (t.id === 'wz-dopo') chiudiWz(); });
  }
  var k = PASSI_WZ[WZ.passo], tot = PASSI_WZ.length - 2, n = Math.min(Math.max(WZ.passo, 1), tot);
  var corpo;
  if (k === 'intro') corpo = '<h2 id="wz-tit">Benvenuto' + (CF.hotel && CF.hotel.nome ? ' all’' + esc(CF.hotel.nome) : '') + '!</h2><p>Ti faccio qualche domanda sul tuo hotel: servono all’assistente per rispondere ai clienti su WhatsApp e sul sito, e per scrivere le email agli ospiti. Ci vogliono circa 10 minuti.</p><p class="note">Ogni passo viene salvato subito e puoi cambiare tutto quando vuoi da Impostazioni. Se un campo non ti riguarda, lascialo vuoto.</p>';
  else if (k === 'fine') corpo = '<h2 id="wz-tit">Ottimo, ci siamo quasi</h2><p>Manca l’ultima cosa: le <b>camere</b> e i <b>prezzi</b>. Nella pagina Camere e listino inserisci le tue camere (numero e tipologia) e i prezzi della stagione: l’assistente li usa per ogni preventivo.</p><p class="note">Le tipologie di camera (doppia, tripla…) e gli extra prenotabili li trovi in fondo a Impostazioni.</p>';
  else { var s = sezione(k), o = CF[k] || {}; corpo = '<p class="note" style="margin:0">Passo ' + n + ' di ' + tot + '</p><h2 id="wz-tit">' + esc(s.t) + '</h2>' + (s.nota ? '<p class="note">' + esc(s.nota) + '</p>' : '') + '<div class="griglia">' + s.campi.map(function(c){ return campoHtml('wz-' + k, c, o[c[0]] == null ? '' : o[c[0]]).replace(/data-cf="wz-/, 'data-cf="'); }).join('') + '</div>'; }
  w.innerHTML = '<div class="wz-box">' + corpo + '<p class="note" id="wz-stato" aria-live="polite"></p><div class="wz-azioni">'
    + (WZ.passo > 0 ? '<button class="btn" type="button" id="wz-indietro">Indietro</button>' : '<button class="btn" type="button" id="wz-dopo">Lo faccio dopo</button>')
    + '<button class="btn primary" type="button" id="wz-avanti">' + (k === 'intro' ? 'Iniziamo' : k === 'fine' ? 'Vai a Camere e listino' : 'Salva e continua') + '</button></div></div>';
  w.hidden = false; WZ.aperta = true;
  var primo = w.querySelector('input,textarea'); if (primo) primo.focus(); else $('#wz-avanti').focus();
}
function salvaWz(fine){
  var dati = clone(CF); if (fine) dati.da_completare = false;
  return chiamaG({ azione: 'salva_config', dati: dati }).then(function(){ if (G) G.config = clone(dati); CF = clone(dati); });
}
function avantiWz(d){
  var k = PASSI_WZ[WZ.passo];
  if (d < 0) { WZ.passo = Math.max(0, WZ.passo - 1); return disegnaWizard(); }
  if (k === 'hotel' && !(CF.hotel && String(CF.hotel.nome || '').trim())) { $('#wz-stato').textContent = 'Scrivi almeno il nome dell’hotel.'; return; }
  var b = $('#wz-avanti'); b.disabled = true; $('#wz-stato').textContent = '';
  var fine = k === 'fine';
  (k === 'intro' ? Promise.resolve() : salvaWz(fine)).then(function(){
    if (fine) { chiudiWz(); disegnaImpostazioni(); if (window.apri) apri('camere'); toast('Impostazioni salvate. Ora inserisci camere e prezzi.'); return; }
    WZ.passo++; disegnaWizard();
  }).catch(function(e){ b.disabled = false; errore(e, $('#wz-stato')); });
}
function chiudiWz(){ var w = $('#wizard'); if (w) w.hidden = true; WZ.aperta = false; }
function forseWizard(){ if (G && G.config && G.config.da_completare === true && !WZ.aperta) { CF = clone(G.config); WZ.passo = 0; disegnaWizard(); } }
var primaW = window.caricaG;
window.caricaG = function(){ return Promise.resolve(primaW()).then(function(){ forseWizard(); }); };
})();

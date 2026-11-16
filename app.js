/* TRACE · structural prototype
   One fictional investigation (case FR-2611), 10 main screens and 3 edge cases.
   Everything is simulated and deterministic. Uses only the shared design system in ds/. */
(() => {
'use strict';

/* =========================================================
   1. SCENARIO DATA. The single source of truth for every screen
   ========================================================= */
const D = {
  caseId: 'FR-2611',
  title: 'Precision dropped on the card fraud model',
  model: 'fraud-xgb', version: 'v14', prevVersion: 'v13', versionDate: '28 Oct',
  drop: { was: '91.2%', now: '83.2%', since: 'Sat 7 Nov 02:00' },
  opened: 'Mon 9 Nov 08:30',
  sources: [
    { id: 'mon', name: 'Model Monitoring', icon: 'monitor', what: 'Precision, recall, alerts, decision rules' },
    { id: 'fs', name: 'Feature Store', icon: 'database', what: '42 features for fraud-xgb' },
    { id: 'pl', name: 'Data Pipeline Logs', icon: 'pipeline', what: 'Ingestion and feature jobs, last 30 days' },
    { id: 'mr', name: 'Model Registry', icon: 'registry', what: 'Model versions, deployment history, model metadata' }
  ],
  rootCause: 'A column rename in the payments ingestion job left merchant_category empty for a third of transactions, so the model scored a third of transactions without one of its inputs.',
  cr: 'CR-1187',
  owner: 'Data Platform team'
};
const SRC = Object.fromEntries(D.sources.map(s => [s.id, s]));

// Evidence: numbered once, cited the same way everywhere
const EV = {
  e1: { n: 1, src: 'mon', id: 'ev-0401', title: 'Precision on fraud-xgb@v14', was: '91.2%', now: '83.2%', bad: true, when: 'Sat 7 Nov 02:00', read: 'The drop starts at 02:00 on Saturday and holds steady after that.', raw: 'precision_7d(fraud-xgb@v14)\n  before 02:00 Sat 7 Nov  0.912\n  after                   0.832' },
  e2: { n: 2, src: 'fs', id: 'ev-0412', title: 'merchant_category null rate', was: '0.4%', now: '31.7%', bad: true, when: 'Sat 7 Nov 02:14', read: 'The share of transactions with no merchant category (the type of shop, such as grocery or travel) jumped from 0.4% to 31.7%, starting with the first batch after the ingestion job ran.', raw: 'SELECT avg(merchant_category IS NULL)\nFROM features.card_txn\nWHERE ts >= \'2026-11-07 02:00\'   -- 0.317\n-- baseline 26 Oct to 6 Nov       -- 0.004' },
  e3: { n: 3, src: 'pl', id: 'ev-0419', title: 'Column renamed in payments_ingest', value: 'merchant_category → merchant_cat', when: 'Sat 7 Nov 01:55', read: 'The upstream payments table renamed the field nineteen minutes before the nulls began. It was the only infrastructure change since Friday, so there was nothing else to ask MLOps about.', raw: 'job payments_ingest run 4471\n01:55:12 schema change: merchant_category -> merchant_cat\n01:58:40 status=succeeded rows=1,204,331 failed=0' },
  e4: { n: 4, src: 'mr', id: 'ev-0423', title: 'Model versions and deployments', value: 'v14 in production since 28 Oct', when: 'Mon 9 Nov 08:35', read: 'No new version was registered or deployed in the window, and both v14 and v13 list merchant_category as an input.', raw: 'registered model fraud-xgb\n  v14  stage=Production  deployed 28 Oct 10:12  inputs: amount, merchant_category, hour, +39\n  v13  stage=Archived    deployed 02 Sep        inputs: amount, merchant_category, hour, +38\nno registrations or stage changes since 28 Oct' },
  e5: { n: 5, src: 'mon', id: 'ev-0427', title: 'Decline rule FR-R12 changed', value: 'touches 2% of transactions', when: 'Fri 6 Nov 17:00', read: 'It can raise false positives, but it started nine hours before precision fell.', raw: 'rule FR-R12 threshold 0.82 -> 0.78\nchanged Fri 6 Nov 17:00 by fraud-ops\naffected volume 2.1%' },
  e6: { n: 6, src: 'pl', id: 'ev-0420', title: 'payments_ingest run status', value: 'succeeded, 0 failed rows', when: 'Sat 7 Nov 01:58', read: 'The job reports clean data, which seems to contradict the empty feature.', raw: 'job payments_ingest run 4471\nstatus=succeeded rows=1,204,331 failed=0' }
};
const MISSING = { title: 'Chargeback confirmations', src: 'mon', read: 'Precision so far comes from fraud analysts’ reviews. Bank chargebacks, the final confirmation of fraud for 7 to 9 Nov, arrive by Wed 11 Nov.' };

const SUSPECTS = {
  s1: { label: 'S1', title: 'An upstream schema change emptied merchant_category.', why: 'The field went empty nineteen minutes after a column rename, at the hour precision fell, and only features reading it drifted.', level: 4, conf: 'High', status: 'leading', support: ['e2', 'e3', 'e4'], against: [], missing: true },
  s2: { label: 'S2', title: 'Friday\'s decline-rule change raised false positives.', why: 'It fits the rise in false positives, but not the timing of the precision drop.', level: 2, conf: 'Low', status: 'low-confidence', support: ['e5'], against: ['e1'], missing: false },
  s3: { label: 'S3', title: 'A bad model release.', why: 'Model Registry shows no new version registered or deployed in the window.', level: 0, conf: 'Ruled out', status: 'ruled-out', support: [], against: ['e4'], missing: false }
};

// Main journey. Numbered because it is a real sequence
const STEPS = [
  ['investigate', 'Investigate'], ['suspects', 'Suspects'], ['root-cause', 'Root cause'],
  ['approve', 'Decide'], ['watch', 'Watching'], ['record', 'Decision record']
];
// Screens merged into others; old links redirect
const ALIAS = { recheck: 'root-cause', plan: 'approve', decided: 'watch' };
const EDGES = { 'low-confidence': ['investigate', 'Low confidence'], 'conflict': ['suspects', 'Conflicting evidence'], 'wrong': ['root-cause', 'Wrong diagnosis'] };
const TITLES = Object.assign({ cases: 'Cases', models: 'Models' }, Object.fromEntries(STEPS), Object.fromEntries(Object.entries(EDGES).map(([k, v]) => [k, v[1]])));

// The investigation Trace runs when Maya starts it
const RUN = [
  { src: 'mon', title: 'Confirm the drop and when it started', note: 'Precision 91.2% → 83.2% from Sat 7 Nov 02:00', ev: 'e1' },
  { src: 'fs', title: 'Compare 42 features with the training baseline', note: 'merchant_category empty 31.7% of the time', ev: 'e2' },
  { src: 'pl', title: 'Check pipeline runs and infrastructure changes since Friday', note: 'One change only: payments_ingest renamed a column at Sat 01:55. No other infrastructure changes.', ev: 'e3' },
  { src: 'mr', title: 'Check model versions and deployment history', note: 'No new version or deployment since v14 on 28 Oct', ev: 'e4' },
  { src: null, title: 'Rank possible causes', note: 'Three suspects, one clearly ahead' }
];

/* =========================================================
   2. STATE. In memory only: a reload or Restart starts the scenario again
   ========================================================= */
const KEY = 'trace-prototype-v1';
const fresh = () => ({
  reached: -1, run: 'idle', runStep: 0, suspect: 's1', node: 'e2',
  decision: null, rejectReason: '', moreRequested: false, pushback: 'none', pushText: '',
  lowConfResolved: false, conflict: 'open', reinvest: 0, context: '',
  threads: {}, logged: {},
  events: [
    { t: 'Mon 9 Nov 08:15', who: 'system', by: 'Fraud ops', title: 'reported more false positives over the weekend', what: 'Genuine customers’ payments flagged as fraud' },
    { t: 'Mon 9 Nov 08:30', who: 'system', title: 'Model Monitoring raised an alert', what: 'Daily precision check: the weekend’s flagged transactions, reviewed by fraud analysts, show precision at 83.2%, below the 85% alert level' },
    { t: 'Mon 9 Nov 08:30', who: 'agent', title: 'Trace opened case FR-2611', what: 'A quick check confirmed the drop is real' }
  ]
});
// Every page load starts the scenario from the beginning; state lives in memory only
let S = fresh();
try { sessionStorage.removeItem(KEY); } catch {}
// A reload restarts the whole prototype from Cases; a direct link to a screen still opens that screen
try { if (performance.getEntriesByType('navigation')[0]?.type === 'reload' && location.hash !== '#/cases') history.replaceState(null, '', '#/cases'); } catch {}
const save = () => {};
const log = (key, ev) => { if (key && S.logged[key]) return; if (key) S.logged[key] = 1; S.events.push(ev); };

/* =========================================================
   3. SMALL RENDER HELPERS (all markup uses ds/ components)
   ========================================================= */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = n => `<i data-icon="${n}"></i>`;
const st = (s, text = '') => `<span class="status" data-status="${s}">${text}</span>`;
const shift = (was, now, cls = '') => `<span class="shift"><span class="was">${was}</span><i class="to"></i><span class="now ${cls}">${now}</span></span>`;
const meter = '<span class="conf-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
const conf = (level, word, why = '') => `<span class="conf" data-level="${level}">${meter}<b>${word}</b>${why ? `<small>${why}</small>` : ''}</span>`;
const cite = id => `<a class="cite" href="#/suspects" data-ev="${id}" title="${esc(EV[id].title)}">${EV[id].n}</a>`;
const srcTag = id => `<span class="tag">${ic(SRC[id].icon)}${SRC[id].name}</span>`;
const go = r => { location.hash = '#/' + r; };
// Scenario time as a sortable number: Mon 9 Nov = day 0, Tue 10 Nov = day 1
const when = t => { const [d, , , hm] = t.split(' '); const [h, m] = hm.split(':'); return ({ Mon: 0, Tue: 1, Wed: 2 }[d] || 0) * 1440 + (+h) * 60 + (+m); };

function evidence(id, rel, hypo, { open = false } = {}) {
  const e = EV[id], s = SRC[e.src];
  const val = e.was ? shift(e.was, e.now, e.bad ? 'bad' : '') : esc(e.value);
  const relTag = rel === 'supports' ? `<span class="rel-tag supports">${ic('check')}Supports</span>` : rel === 'contradicts' ? `<span class="rel-tag contradicts">${ic('x')}Contradicts</span>` : '';
  return `<article class="evidence" data-relation="${rel || ''}" id="ev-${id}">
    <span class="source-ic">${ic(s.icon)}</span>
    <div><div class="evidence-src"><b>${s.name}</b><span class="cite">${e.n}</span><span class="ev-id">${e.id}</span></div>
      <h3>${esc(e.title)}</h3><div class="obs">${val}</div><p>${esc(e.read)}</p></div>
    <time class="when">${e.when}</time>
    ${relTag || hypo ? `<div class="rel">${relTag}${hypo ? `<span class="hypo-link">${hypo}</span>` : ''}</div>` : ''}
    <details${open ? ' open' : ''}><summary>Inspect source record${ic('chevDown').replace('<i', '<i class="chev"')}</summary><pre class="ev-raw">${esc(e.raw)}</pre></details>
  </article>`;
}
const missingCard = hypo => `<article class="evidence" data-relation="missing">
    <span class="source-ic">${ic('circleDash')}</span>
    <div><div class="evidence-src"><b>${SRC[MISSING.src].name}</b></div><h3>${MISSING.title}</h3><p>${MISSING.read}</p></div><span></span>
    <div class="rel"><span class="rel-tag missing">${ic('circleDash')}Missing</span>${hypo ? `<span class="hypo-link">${hypo}</span>` : ''}</div></article>`;

const head = (title, extra = '') => `<div class="page-hd"><div><h1 class="t-page">${title}</h1><div class="sub">${extra}</div></div></div>`;
const caseSub = () => `<span class="t-id">${D.caseId}</span><span class="tag mono">${D.model}@${D.version}</span>${shift(D.drop.was, D.drop.now, 'bad')}<span class="t-meta">since ${D.drop.since}</span>`;
const actions = (left, right) => `<div class="page-actions">${left || ''}<div class="end">${right || ''}</div></div>`;
const edgeLink = (route, text) => `<a class="edge" href="#/${route}"><span class="tag">${ic('branch')}Edge case</span>${text}</a>`;
const alert = (tone, icon, title, body, acts = '') => `<div class="alert banner-alert" data-tone="${tone}" style="margin-bottom:var(--sp-5)">${ic(icon)}<div><b>${title}</b><p>${body}</p></div><div class="actions">${acts}</div></div>`;

/* =========================================================
   4. SCREENS
   ========================================================= */
const V = {};

// 01 Cases. The original structure, with the change promoted and one clear next step
V.cases = () => {
  const stage = S.decision ? 'decided' : S.run === 'done' ? 'review' : S.run === 'running' ? 'running' : 'new';
  const resume = (STEPS[Math.max(1, S.reached)] || STEPS[1])[0];
  const status = { new: st('awaiting-approval', 'Ready to investigate'), running: st('investigating'), review: st('needs-review'), decided: st(S.decision === 'approved' ? 'approved' : 'rejected') }[stage];
  const trace = {
    new: 'The drop is real. I haven’t looked for the cause yet.',
    running: `Reading the four sources, ${S.runStep} of ${RUN.length} checks done.`,
    review: 'Three possible causes found, one clearly ahead.',
    decided: S.decision === 'approved' ? 'Cause found and fix approved. Watching precision.' : 'Plan rejected. Waiting for a new one.'
  }[stage];
  const action = {
    new: `<a class="btn btn-primary" href="#/investigate">Open investigation</a>`,
    running: `<a class="btn btn-primary" href="#/investigate">Follow investigation</a>`,
    review: `<a class="btn btn-primary" href="#/${resume}">Continue</a>`,
    decided: `<a class="btn btn-secondary" href="#/record">Decision record</a>`
  }[stage];
  return `
  ${head('Cases', '<span class="t-secondary">Trace opens a case when Model Monitoring raises an alert.</span>')}
  <section class="sec" style="margin-top:0"><h2>Needs you</h2>
    <article class="tcard case cx" aria-labelledby="cx-title">
      <div class="cx-top"><span class="t-id">${D.caseId}</span><span>${D.model}@${D.version}, opened ${D.opened}</span><span class="sev high">High</span></div>
      <h3><a id="cx-title" href="#/investigate">${D.title}</a></h3>
      <div class="cx-metric">
        <span class="cx-vals" role="img" aria-label="Precision fell from ${D.drop.was} to ${D.drop.now}"><span class="was">${D.drop.was}</span><i class="to" aria-hidden="true"></i><span class="now">${D.drop.now}</span><span class="cx-label">precision</span></span>
        <p class="cx-why"><span class="cx-delta">${ic('arrowDown')}8.0 points.</span> More genuine payments are being flagged as fraud, and fraud ops have already raised it.</p>
      </div>
      <div class="cx-foot">
        <span class="avatar agent" title="Trace">${ic('trace')}</span>
        <p class="cx-trace"><b>Trace</b> ${trace}</p>
        <div class="cx-act">${action}</div>
      </div>
    </article>
  </section>
  <section class="sec"><h2>Other open cases</h2>
    <div class="tcard case">
      <div class="case-top">${st('queued')}<span class="t-id">FR-2604</span><div class="end"><span class="sev medium">Medium</span></div></div>
      <h3>Scoring slower than target</h3>
      <div class="case-metric">${shift('41 ms', '79 ms', 'bad')}<span class="tag mono">${D.model}@${D.version}</span><span>Trace starts after FR-2611</span></div>
    </div>
  </section>
  <section class="sec"><h2>Closed this month</h2>
    <div class="card"><table class="table"><thead><tr><th scope="col">Case</th><th scope="col">Cause</th><th scope="col">Closed</th></tr></thead><tbody>
      <tr><td class="primary">Scoring slower than usual<span class="sub t-id">FR-2588</span></td><td>Server memory limit</td><td class="t-meta">4 Nov</td></tr>
      <tr><td class="primary">More declines flagged in one region<span class="sub t-id">FR-2561</span></td><td>Real fraud spike, no change made</td><td class="t-meta">29 Oct</td></tr>
    </tbody></table></div>
  </section>`;
};

// 02 Investigate
V.investigate = () => {
  const running = S.run === 'running', done = S.run === 'done';
  const act = RUN.map((r, i) => {
    const state = done || i < S.runStep ? (r.ev ? 'finding' : 'completed') : running && i === S.runStep ? 'running' : 'queued';
    return `<li class="act" data-state="${state}"><span class="act-ic">${state === 'queued' ? ic(r.src ? SRC[r.src].icon : 'scale') : state === 'running' ? ic('loader') : ic(r.ev ? 'lightbulb' : 'check')}</span><div><b>${r.title}</b><small>${r.src ? SRC[r.src].name : 'Trace'}${state === 'running' ? ', running' : ''}</small>${state === 'finding' || (state === 'completed' && !r.ev) ? `<div class="finding-note">${r.note}${r.ev ? ` ${cite(r.ev)}` : ''}</div>` : ''}</div></li>`;
  }).join('');
  return `
  ${head(D.title, caseSub())}
  ${S.reinvest ? alert('info', 'refresh', `Investigation ${S.reinvest + 1}: your context first`, `“${esc(S.context)}” Trace keeps every finding from the last investigation and tests your context against all four sources.`) : ''}
  ${S.lowConfResolved ? alert('success', 'checkCircle', 'Data Pipeline Logs responded on retry', 'All four sources are available again.') : ''}
  <section class="sec" style="margin-top:0"><h2>Objective</h2>
    <p class="objective">Find out why precision on ${D.model}@${D.version} fell from ${D.drop.was} to ${D.drop.now} since ${D.drop.since}, and recommend a fix you can approve. Trace reads sources only; nothing in production changes without your decision.</p>
  </section>
  <section class="sec"><h2>Connected sources</h2>
    <div class="sources">${D.sources.map(s => `<div class="source"><span class="source-ic">${ic(s.icon)}</span><div><b>${s.name}</b><small>${s.what}</small></div><span class="end"><span class="conn" data-status="read-only"></span></span></div>`).join('')}</div>
  </section>
  <section class="sec"><h2>Investigation plan <small>${done ? 'Completed' : running ? `Step ${S.runStep + 1} of ${RUN.length}` : 'Not started'}</small></h2>
    <div class="card card-bd"><div class="progress" style="margin-bottom:var(--sp-5)"><div class="progress-top"><span><b>${done ? RUN.length : S.runStep} of ${RUN.length}</b> checks completed</span><span>${done ? 'Took 4 minutes' : 'About 4 minutes'}</span></div><div class="progress-bar" aria-hidden="true">${RUN.map((r, i) => `<span class="${done || i < S.runStep ? 'done' : running && i === S.runStep ? 'active' : ''}"></span>`).join('')}</div></div><ol class="activity">${act}</ol></div>
  </section>
  ${actions(done ? '' : edgeLink('low-confidence', 'What if a source doesn\'t respond?'),
    done ? `<a class="btn btn-primary" href="#/suspects">Review suspects</a>` : `<button class="btn btn-primary" data-act="start" ${running ? 'aria-busy="true"' : ''}>${running ? 'Investigating' : 'Start investigation'}</button>`)}`;
};

// 03 Suspects
V.suspects = () => {
  const sel = SUSPECTS[S.suspect];
  const list = Object.entries(SUSPECTS).map(([id, h]) => `
    <button class="tcard mini-hypo" ${id === S.suspect ? 'aria-current="true"' : ''} data-act="suspect" data-id="${id}">
      <span class="row"><b class="t-label" style="color:var(--text-2)">${h.label}</b>${st(h.status)}${h.level ? `<span style="margin-left:auto">${conf(h.level, h.conf)}</span>` : ''}</span>
      <p>${h.title}</p>${id === 's2' && S.pushback === 'done' ? '<span class="t-meta" style="display:block;margin-top:6px">Re-checked after your challenge</span>' : ''}</button>`).join('');
  const evs = sel.support.map(e => evidence(e, 'supports', `Supports <b>${sel.label}</b>`)).join('') + sel.against.map(e => evidence(e, 'contradicts', `Contradicts <b>${sel.label}</b>`)).join('') + (sel.missing ? missingCard(`Affects <b>${sel.label}</b>`) : '');
  return `
  ${head('Suspects', caseSub())}
  ${S.lowConfResolved && S.conflict !== 'resolved' ? alert('success', 'checkCircle', 'Data Pipeline Logs responded on retry', 'All four sources are in, so confidence is back to normal.') : ''}
  ${S.conflict === 'resolved' ? alert('success', 'checkCircle', 'Discrepancy explained', 'The ingestion job was clean; the feature reader still asked for the old column name. Evidence 2 and 6 now agree.') : ''}
  <div class="split">
    <div class="hypo-list" role="list" aria-label="Possible causes">${list}</div>
    <div>
      <article class="tcard hypo">
        <div class="finding-hd"><span class="rank">${sel.label}</span>${st(sel.status)}<div class="end">${sel.level ? conf(sel.level, sel.conf, sel === SUSPECTS.s1 ? '3 of 4 sources agree' : '') : ''}</div></div>
        <div class="hypo-bd"><h3>${sel.title}</h3><p class="why">${sel.why}</p></div>
        <div class="hypo-ft"><div class="tally"><span class="sup">${ic('check')}${sel.support.length} support</span><span class="con">${ic('x')}${sel.against.length} contradict</span>${sel.missing ? `<span class="mis">${ic('circleDash')}1 missing</span>` : ''}</div></div>
      </article>
      <div class="stack gap-3" style="margin-top:var(--sp-4)">${evs}</div>
      ${S.suspect === 's1' && S.conflict !== 'resolved' ? `<div style="margin-top:var(--sp-4)">${alert('warning', 'conflict', 'Two sources disagree', `${SRC.fs.name} shows merchant_category empty, but ${SRC.pl.name} report the ingestion job succeeded with no failed rows.`, '<a class="btn btn-secondary btn-sm" href="#/conflict">Investigate the discrepancy</a>')}</div>` : ''}
    </div>
  </div>
  ${pushback()}
  ${actions(edgeLink('conflict', 'Conflicting evidence'), '<a class="btn btn-primary" href="#/recheck">Re-check the leading suspect</a>')}`;
};

// Maya pushes back on Trace's ranking. Trace re-checks before answering; both go in the record
const PUSH_SUGGESTION = 'Fraud ops changed a decline rule on Friday. I think that caused it, not the schema change.';
const pushback = () => {
  if (S.pushback === 'done') return `
  <section class="pushback" aria-label="Your challenge">
    <div class="msg human"><span class="avatar">MR</span><div><div class="msg-hd"><b>You</b><span class="kind">Challenge</span></div><div class="msg-bd">${esc(S.pushText)}</div></div></div>
    <div class="msg agent" style="margin-top:var(--sp-3)"><span class="avatar agent">${ic('trace')}</span><div><div class="msg-hd"><b>Trace</b><span>Re-checked Model Monitoring</span></div>
      <p class="voice" style="font-size:var(--fs-16);margin-top:4px">Good challenge, so I checked it. The rule changed at 17:00 on Friday, nine hours before precision fell, and it only touches 2% of payments ${cite('e5')}. It can’t explain a drop that starts at 02:00 on Saturday ${cite('e1')}. I’m keeping S1 first.</p>
      <p class="t-meta" style="margin-top:var(--sp-2)">You can still override this later by rejecting the plan.</p></div></div>
  </section>`;
  const busy = S.pushback === 'checking';
  return `
  <section class="pushback" aria-labelledby="pb-title">
    <div class="pb-hd"><span class="avatar">MR</span><div><h2 id="pb-title">Disagree with this ranking?</h2><p>Tell Trace what you know. It re-checks the evidence before answering.</p></div></div>
    <div class="field" style="margin-top:var(--sp-3)"><label class="sr" for="pb-text">Your challenge</label><textarea class="input" id="pb-text" rows="2" placeholder="For example: fraud ops changed a decline rule on Friday" ${busy ? 'disabled' : ''}>${esc(S.pushText)}</textarea></div>
    <div class="row gap-2" style="margin-top:var(--sp-3);flex-wrap:wrap">
      <button class="chip" data-act="pb-fill" ${busy ? 'disabled' : ''}>Use: “Fraud ops changed a decline rule on Friday…”</button>
      <button class="btn btn-human btn-sm" style="margin-left:auto" data-act="pb-send" ${busy ? 'aria-busy="true"' : ''} ${S.pushText || busy ? '' : 'disabled'} id="pb-send">${busy ? 'Trace is re-checking' : 'Challenge Trace'}</button>
    </div>
  </section>`;
};

// 04 Re-checked
const RECHECK_NODES = [['e2', 'fs'], ['e3', 'pl'], ['e4', 'mr']];
V.recheck = () => {
  const node = (id, src) => `<button class="node" data-type="evidence" data-relation="supports" data-state="supports" data-act="node" data-id="${id}" ${S.node === id ? 'aria-current="true"' : ''}><span class="node-hd"><span class="node-ic">${ic('check')}</span><span class="node-kind">Evidence ${EV[id].n}</span><span class="node-st" data-status="supports"></span></span><span class="node-bd"><span class="node-title">${esc(EV[id].title)}</span><span class="node-meta">${SRC[src].name}</span></span></button>`;
  return `
  ${head('Re-checked', caseSub())}
  ${S.moreRequested ? alert('info', 'refresh', 'You asked for further investigation', 'Trace re-ran every cross-check and sampled 500 transactions by hand. The result is unchanged.', '<a class="btn btn-secondary btn-sm" href="#/approve">Back to your decision</a>') : ''}
  <div class="chips" style="margin-bottom:var(--sp-5)">${st('supports', '3 confirmed')}${st('contradicts', '1 contradiction')}${st('missing', '1 missing')}</div>
  <div class="canvas" role="group" aria-label="Cross-source check of suspect S1">
    <div class="canvas-legend"><span><i class="done"></i>Checked</span><span><i class="pending"></i>Waiting</span></div>
    <div class="wf">
      <button class="node" data-type="agent" data-state="completed" data-act="node" data-id="e1" ${S.node === 'e1' ? 'aria-current="true"' : ''}><span class="node-hd"><span class="node-ic">${ic('trace')}</span><span class="node-kind">Agent action</span><span class="node-st" data-status="completed"></span></span><span class="node-bd"><span class="node-title">Cross-check S1 in three other sources</span></span></button>
      <div class="wf-link done"></div>
      <div class="wf-split join">${RECHECK_NODES.map(([id, s]) => `<div class="wf">${node(id, s)}<i class="wf-tail"></i></div>`).join('')}</div>
      <div class="wf-link supports"></div>
      <button class="node" data-type="hypothesis" data-state="completed" data-act="node" data-id="s1" ${S.node === 's1' ? 'aria-current="true"' : ''}><span class="node-hd"><span class="node-ic">${ic('lightbulb')}</span><span class="node-kind">Suspect S1</span><span class="node-st" data-status="completed">Confirmed</span></span><span class="node-bd"><span class="node-title">${SUSPECTS.s1.title}</span><span class="node-conf">${conf(4, 'High')}</span></span></button>
    </div>
  </div>
  <section class="sec"><h2>Selected</h2>${S.node === 's1' ? `<div class="card card-bd"><p class="voice">${SUSPECTS.s1.why}</p></div>` : evidence(S.node, S.node === 'e1' ? '' : 'supports', S.node === 'e1' ? '' : 'Supports <b>S1</b>', { open: true })}</section>
  <section class="sec"><h2>Where the value went</h2>
    <div class="compare-wrap">
      <div class="compare-hd"><h3>merchant_category, ${SRC.fs.name} vs upstream</h3><div class="end">${st('supports')}</div></div>
      <div class="compare" style="--cols:3">
        <div><div class="hd">${ic('database')}Training baseline</div><div class="big">0.4%</div><div class="note">empty, 26 Oct to 6 Nov</div></div>
        <div><div class="hd">${ic('database')}Since ${D.drop.since}</div><div class="big bad">31.7%</div><div class="note">empty in the Feature Store</div></div>
        <div><div class="hd">${ic('pipeline')}Upstream payments table</div><div class="big">0.3%</div><div class="note">empty, now called merchant_cat</div></div>
      </div>
      <div class="compare-ft">The value isn't missing upstream. It was renamed, and the feature pipeline still reads the old name.</div>
    </div>
  </section>
  <section class="sec"><h2>Contradictions and gaps</h2><div class="stack gap-3">${evidence('e5', 'contradicts', 'Weakens <b>S2</b>: wrong timing')}${missingCard('Affects <b>every suspect</b>')}</div></section>
  ${actions('', '<a class="btn btn-primary" href="#/root-cause">See the diagnosis</a>')}`;
};

// 05 Root cause
V['root-cause'] = () => `
  ${head('Root cause', caseSub())}
  <article class="tcard rootcause">
    <div class="rc-hd"><h3>Diagnosis</h3><span class="t-meta">Found in 4 minutes across 4 sources</span><div class="end">${conf(4, 'High', '3 of 4 sources agree')}</div></div>
    <div class="rc-claim"><p>${D.rootCause}</p><div class="rc-impact">Precision ${shift(D.drop.was, D.drop.now, 'bad')} since ${D.drop.since}</div></div>
    <div class="rc-cols">
      <div class="ok"><h4>${ic('check')}Rests on</h4><ul><li>Field renamed upstream at 01:55 ${cite('e3')}</li><li>Feature empty 31.7% of the time from 02:14 ${cite('e2')}</li><li>v14 in production, unchanged, uses this field as an input ${cite('e4')}</li></ul></div>
      <div class="out"><h4>${ic('minus')}Alternative explanations</h4><ul><li>S2, Friday's rule change: wrong timing ${cite('e5')}</li><li>S3, a bad release: none in the window ${cite('e4')}</li></ul></div>
      <div class="unk"><h4>${ic('circleDash')}Still unknown</h4><ul><li>Bank chargebacks for 7 to 9 Nov, due Wed 11 Nov</li></ul></div>
    </div>
  </article>
  <section class="sec"><h2>Confidence</h2>
    <div class="card card-bd"><div class="conf conf-lg" data-level="4"><div class="conf-top"><b>High confidence</b><span class="t-meta">4 of 5</span></div>${meter}<p>It would drop if the chargebacks due Wednesday disagree with the analysts’ reviews.</p></div></div>
  </section>
  ${actions(edgeLink('wrong', 'Challenge this diagnosis'), '<a class="btn btn-primary" href="#/plan">See the recommended plan</a>')}`;

// 06 Recommended plan
V.plan = () => `
  ${head('Recommended plan', caseSub())}
  <article class="tcard action-card">
    <div class="action-top">${st('proposed')}<span class="t-meta">Recommended by Trace. Nothing has been changed</span><div class="end"><span class="tag">${ic('undo')}Reversible</span></div></div>
    <h3>Restore the merchant_category mapping and backfill since Saturday</h3>
    <p class="why">It fixes the cause, not the symptom, and leaves the model untouched.</p>
    <dl class="action-grid">
      <div><dt>Expected effect</dt><dd>Precision ${shift(D.drop.now, '~91%', 'good')} within a day</dd></div>
      <div><dt>Risk</dt><dd>Low. One mapping change, no retraining</dd></div>
      <div><dt>Undo</dt><dd>Remove the mapping</dd></div>
    </dl>
  </article>
  <section class="sec"><h2>Steps <small>applied by the ${D.owner}, not by Trace</small></h2>
    <div class="card card-bd"><ol class="plan-steps">
      <li><span class="when">Now</span><div><b>Map merchant_cat back to merchant_category</b><p>One line in the feature pipeline config, via change request ${D.cr}.</p></div>${cite('e3')}</li>
      <li><span class="when">Today</span><div><b>Backfill features from ${D.drop.since}</b><p>About 40 minutes. Scores from the gap are not re-issued.</p></div>${cite('e2')}</li>
      <li><span class="when">48 h</span><div><b>Trace watches precision and the null rate</b><p>And reopens the case if either hasn't recovered.</p></div><span></span></li>
    </ol></div>
  </section>
  <section class="sec"><h2>Not recommended</h2>
    <ul class="list-plain">
      <li class="card card-bd" style="padding:var(--sp-4) var(--sp-5)"><b class="t-card" style="font-size:var(--fs-14)">Roll back to ${D.model}@${D.prevVersion}</b><p class="voice" style="font-size:var(--fs-16);margin-top:4px">It wouldn't help: ${D.prevVersion} reads the same field. ${cite('e4')}</p></li>
      <li class="card card-bd" style="padding:var(--sp-4) var(--sp-5)"><b class="t-card" style="font-size:var(--fs-14)">Retrain without merchant_category</b><p class="voice" style="font-size:var(--fs-16);margin-top:4px">It throws away a strong signal and takes days.</p></li>
    </ul>
  </section>
  ${actions('', '<a class="btn btn-human" href="#/approve">Review and decide</a>')}`;

// 07 Approve
V.approve = () => `
  ${head('Your decision', caseSub())}
  <div class="approval" data-state="pending" style="max-width:720px">
    <div class="approval-hd"><span class="avatar">MR</span><div><h3>Approve the plan?</h3><p>Nothing changes until you decide. Trace never changes production itself.</p></div></div>
    <div class="approval-bd">
      <dl class="kv"><dt>Change</dt><dd>Restore the merchant_category mapping and backfill</dd><dt>Applied by</dt><dd>${D.owner}, via ${D.cr}</dd><dt>Affects</dt><dd>All card transaction scoring</dd><dt>Undo</dt><dd>Remove the mapping</dd><dt>Diagnosis</dt><dd>${conf(4, 'High', '3 of 4 sources agree')}</dd></dl>
      <label class="check"><input type="checkbox" id="ap-check"><span>I've reviewed the diagnosis, the evidence and the plan</span></label>
      <div class="field" style="margin-top:var(--sp-4)"><label for="ap-note">Note or reason <span class="t-meta">(required to reject)</span></label><textarea class="input" id="ap-note" rows="2">${esc(S.rejectReason)}</textarea><span class="field-msg" id="ap-msg"></span></div>
    </div>
    <div class="approval-ft"><button class="btn btn-ghost btn-sm" data-act="more">Request further investigation</button><div class="end"><button class="btn btn-danger btn-sm" data-act="reject">Reject</button><button class="btn btn-human btn-sm" data-act="approve" id="ap-approve" disabled>Approve</button></div></div>
  </div>`;

// 08 Decided
V.decided = () => {
  if (!S.decision) return `${head('Decided', caseSub())}<div class="card"><div class="empty"><span class="empty-ic">${ic('hourglass')}</span><b>No decision yet</b><p>The plan is waiting for your approval.</p><a class="btn btn-human btn-sm" href="#/approve">Review and decide</a></div></div>`;
  const ok = S.decision === 'approved';
  return `
  ${head('Decided', caseSub())}
  <div class="approval" data-state="${S.decision}" style="max-width:720px">
    <div class="approval-hd"><span class="approval-result">${ic(ok ? 'shieldCheck' : 'xCircle')}</span><div><h3>${ok ? 'Plan approved' : 'Plan rejected'}</h3><p>By Maya Rao, Mon 9 Nov 09:05. Recorded in the decision record.</p></div></div>
    <div class="approval-bd"><dl class="kv">
      <dt>Decision</dt><dd>${st(ok ? 'approved' : 'rejected')}</dd>
      ${ok ? `<dt>Change request</dt><dd><span class="t-id">${D.cr}</span> sent to the ${D.owner}</dd><dt>Production</dt><dd>Not changed yet. The ${D.owner} applies the fix</dd>` : `<dt>Reason</dt><dd>${esc(S.rejectReason)}</dd>`}
    </dl></div>
  </div>
  <section class="sec"><h2>Next steps</h2><div class="card card-bd"><ol class="plan-steps">
    ${ok ? `<li><span class="when">1</span><div><b>${D.owner} applies the mapping</b><p>Expected this afternoon.</p></div><span></span></li>
    <li><span class="when">2</span><div><b>Trace watches for 48 hours from the fix</b><p>Precision, the null rate and false positives.</p></div><span></span></li>
    <li><span class="when">3</span><div><b>Chargebacks arrive Wed 11 Nov</b><p>Trace confirms the diagnosis against them.</p></div><span></span></li>` :
    `<li><span class="when">1</span><div><b>The case stays open</b><p>Nothing was changed.</p></div><span></span></li><li><span class="when">2</span><div><b>Ask Trace for another plan, or investigate further</b><p>Your reason is part of the record.</p></div><span></span></li>`}
  </ol></div></section>
  ${actions('', ok ? '<a class="btn btn-primary" href="#/watch">Go to watching</a>' : '<button class="btn btn-secondary" data-act="replan">Ask for another plan</button>')}`;
};

// 09 Watching
V.watch = () => {
  if (S.decision !== 'approved') return `${head('Watching', caseSub())}<div class="card"><div class="empty"><span class="empty-ic">${ic('eye')}</span><b>Nothing to watch yet</b><p>Trace starts watching once a fix is approved and applied.</p><a class="btn btn-secondary btn-sm" href="#/plan">Back to the plan</a></div></div>`;
  // Hourly precision, simulated: falls Sat 02:00, fix Mon 14:00, recovers
  const pts = [91.2, 91.1, 91.3, 83.4, 83.1, 83.2, 83.0, 83.3, 83.2, 86.9, 89.8, 90.4, 90.6];
  const x = i => 20 + i * 55, y = v => 140 - (v - 80) * 11;
  return `
  ${head('Watching', caseSub())}
  ${alert('info', 'flask', 'Simulated monitoring outcome', 'These figures show how recovery would look in this scenario. They are not production data.')}
  <div class="chips" style="margin-bottom:var(--sp-5)">${st('completed', 'Recovering')}<span class="t-meta">Fix applied Mon 9 Nov 14:00. Watching until Wed 11 Nov 14:00</span></div>
  <div class="card metrics">
    <div class="metric"><div class="lab">${ic('target')}Precision</div><div class="val">${shift(D.drop.now, '90.6%', 'good').replace('class="shift"', 'class="shift shift-lg"')}</div><div class="ctx">Baseline ${D.drop.was}</div></div>
    <div class="metric"><div class="lab">${ic('database')}merchant_category empty</div><div class="val">${shift('31.7%', '0.5%', 'good').replace('class="shift"', 'class="shift shift-lg"')}</div><div class="ctx">Baseline 0.4%</div></div>
    <div class="metric"><div class="lab">${ic('flag')}False positives per day</div><div class="val">${shift('1,240', '810', 'good').replace('class="shift"', 'class="shift shift-lg"')}</div><div class="ctx">Baseline 765</div></div>
  </div>
  <section class="sec"><h2>Precision, Sat 7 Nov to Tue 10 Nov <small>simulated</small></h2>
    <div class="card card-bd"><svg class="chart" viewBox="0 0 700 160" role="img" aria-label="Precision falls from 91.2% to about 83% on Saturday and recovers to 90.6% after the fix on Monday at 14:00">
      <line x1="20" x2="680" y1="${y(91.2)}" y2="${y(91.2)}" stroke="var(--gray-300)" stroke-dasharray="4 4"/>
      <text x="${x(4.5)}" y="${y(91.2) - 6}" font-size="12" fill="var(--text-3)" font-family="var(--font)">Baseline 91.2%</text>
      <line x1="${x(8.5)}" x2="${x(8.5)}" y1="10" y2="150" stroke="var(--human)" stroke-width="1"/>
      <text x="${x(8.5) + 6}" y="22" font-size="12" fill="var(--text-2)" font-family="var(--font)">Fix applied, Mon 14:00</text>
      <polyline fill="none" stroke="var(--text)" stroke-width="2" points="${pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>
      <circle cx="${x(12)}" cy="${y(90.6)}" r="4" fill="var(--success)"/>
    </svg></div>
  </section>
  <section class="sec"><h2>Monitoring checkpoints</h2><div class="card card-bd"><ol class="timeline">
    <li><span class="tl-dot human">${ic('check')}</span><div><b>${D.owner} applied the mapping</b><p>${D.cr}, reported by ${SRC.pl.name}</p></div><time>Mon 14:00</time></li>
    <li><span class="tl-dot ok">${ic('check')}</span><div><b>Backfill completed</b><p>Null rate back to 0.5%</p></div><time>Mon 14:40</time></li>
    <li><span class="tl-dot agent">${ic('trace')}</span><div><b>Checkpoint: precision 90.6%</b><p class="who agent">Trace</p></div><time>Tue 09:00</time></li>
    <li><span class="tl-dot">${ic('circleDash')}</span><div><b>Chargebacks due</b><p>Trace will confirm the diagnosis</p></div><time>Wed 11 Nov</time></li>
  </ol></div></section>
  ${actions(edgeLink('wrong', 'Reopen the investigation'), '<a class="btn btn-primary" href="#/record">Open the decision record</a>')}`;
};

// 10 Decision record
V.record = () => {
  const who = { system: ['<span class="avatar system">' + ic('bell') + '</span>', 'Model Monitoring'], agent: ['<span class="avatar agent">' + ic('trace') + '</span>', 'Trace'], maya: ['<span class="avatar">MR</span>', 'Maya Rao'] };
  return `
  ${head('Decision record', caseSub())}
  <div class="card card-bd" style="margin-bottom:var(--sp-5)"><dl class="kv">
    <dt>Diagnosis</dt><dd>${S.run === 'done' ? esc(D.rootCause) : '<span class="t-meta">Not reached yet</span>'}</dd>
    <dt>Decision</dt><dd>${S.decision ? st(S.decision === 'approved' ? 'approved' : 'rejected') + ' <span class="t-meta">by Maya Rao, Mon 9 Nov 09:05</span>' : '<span class="t-meta">Not decided yet</span>'}</dd>
    <dt>Change request</dt><dd>${S.decision === 'approved' ? `<span class="t-id">${D.cr}</span>, applied by the ${D.owner}` : '<span class="t-meta">None</span>'}</dd>
    <dt>Investigations</dt><dd>${S.reinvest + 1}</dd>
  </dl></div>
  <div class="card" style="padding:var(--sp-2) var(--sp-6)"><ol class="audit">${[...S.events].sort((a, b) => when(a.t) - when(b.t)).map(e => `<li><time>${e.t.startsWith('Mon 9 Nov') ? e.t.slice(-5) : e.t.split(' ')[0] + ' ' + e.t.slice(-5)}</time>${who[e.who][0]}<div><b>${e.by || who[e.who][1]}</b> <span class="what">${esc(e.title.replace(new RegExp('^(' + (e.by || who[e.who][1]) + ') ', 'i'), ''))}</span>${e.what ? `<div class="detail${e.who === 'maya' ? ' human' : ''}">${esc(e.what)}</div>` : ''}</div><span class="refs">${(e.refs || []).map(cite).join('')}</span></li>`).join('')}</ol></div>
  <p class="ds-note t-meta" style="margin-top:var(--sp-3)">Times are ${D.opened.split(' ').slice(0, 3).join(' ')} unless shown otherwise in the entry.</p>
`;
};

// Edge case: Low confidence (from Investigate)
V['low-confidence'] = () => `
  ${head('Low confidence', caseSub())}
  ${alert('warning', 'lowConf', `${SRC.pl.name} didn't respond`, 'Trace waited 30 seconds and retried once. With three of four sources, it can\'t confirm where the field went missing.', '<button class="btn btn-secondary btn-sm" data-act="retry">Retry the source</button>')}
  <section class="sec" style="margin-top:0"><h2>What Trace has</h2><div class="stack gap-3">${evidence('e1', '', '')}${evidence('e2', '', 'Points to <b>S1 or a data issue</b>')}</div></section>
  <section class="sec"><h2>Possible explanations <small>none can be confirmed yet</small></h2><div class="ds-cols" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--sp-3)">
    ${[['A change upstream emptied the field', 2], ['The feature job itself failed', 2], ['A real change in merchant data', 1]].map(([t, l]) => `<div class="tcard mini-hypo"><span class="row">${st('low-confidence')}</span><p>${t}</p><span class="row" style="margin-top:var(--sp-2)">${conf(l, 'Low')}</span></div>`).join('')}
  </div></section>
  <section class="sec"><h2>Missing information</h2>${missingCard('Affects <b>every explanation</b>')}<div class="card card-bd" style="margin-top:var(--sp-3)"><p class="t-body"><b>${SRC.pl.name}:</b> the ingestion and feature job history since Friday.</p></div></section>
  <section class="sec"><h2>Additional checks</h2><div class="card card-bd"><ol class="plan-steps">
    <li><span class="when">Best</span><div><b>Retry ${SRC.pl.name}</b><p>Would separate the first two explanations.</p></div><button class="btn btn-secondary btn-sm" data-act="retry">Retry</button></li>
    <li><span class="when">Slower</span><div><b>Ask the ${D.owner} for the job history</b><p>Same information, by hand.</p></div><span></span></li>
  </ol></div></section>
  ${actions('<a class="btn btn-ghost" href="#/investigate">Back to Investigate</a>', '<button class="btn btn-primary" data-act="retry">Retry and continue</button>')}`;

// Edge case: Conflicting evidence (from Suspects)
V.conflict = () => {
  const resolving = S.conflict === 'resolving', resolved = S.conflict === 'resolved';
  return `
  ${head('Conflicting evidence', caseSub())}
  <div class="compare-wrap">
    <div class="compare-hd"><h3>Is merchant_category data missing?</h3><div class="end">${resolved ? st('supports', 'Explained') : st('conflicting')}</div></div>
    <div class="compare">
      <div><div class="hd">${ic('database')}${SRC.fs.name} <span class="cite">${EV.e2.n}</span></div><div class="big bad">31.7% empty</div><div class="note">Since ${D.drop.since}</div></div>
      <div><div class="hd">${ic('pipeline')}${SRC.pl.name} <span class="cite">${EV.e6.n}</span></div><div class="big">0 failed rows</div><div class="note">payments_ingest succeeded, Sat 01:58</div></div>
    </div>
    <div class="compare-ft">${resolved ? 'Both are true. The job loaded every row, but under the new column name merchant_cat. The feature reader still asks for merchant_category and gets nothing.' : 'Both can\'t be the whole story. Trace will look for what makes them consistent before trusting either.'}</div>
  </div>
  <section class="sec"><h2>Trace's check</h2><div class="card card-bd"><ol class="activity">
    <li class="act" data-state="${resolving || resolved ? 'completed' : 'queued'}"><span class="act-ic">${ic('check')}</span><div><b>Read the ingestion job's schema log</b><small>${SRC.pl.name}</small></div></li>
    <li class="act" data-state="${resolved ? 'finding' : resolving ? 'running' : 'queued'}"><span class="act-ic">${ic(resolved ? 'lightbulb' : 'database')}</span><div><b>Compare column names on both sides</b><small>${SRC.fs.name}</small>${resolved ? `<div class="finding-note">merchant_category was renamed to merchant_cat at 01:55. ${cite('e3')}</div>` : ''}</div></li>
  </ol></div></section>
  ${actions('<a class="btn btn-ghost" href="#/suspects">Back to Suspects</a>', resolved ? '<a class="btn btn-primary" href="#/root-cause">Continue to the diagnosis</a>' : `<button class="btn btn-primary" data-act="resolve" ${resolving ? 'aria-busy="true"' : ''}>${resolving ? 'Investigating' : 'Investigate the discrepancy'}</button>`)}`;
};

// Edge case: Wrong diagnosis (from Root cause or Watching)
V.wrong = () => `
  ${head('Challenge the diagnosis', caseSub())}
  <div class="card card-bd"><p class="t-label">Current diagnosis, kept as it is</p><p class="voice-lg" style="margin-top:var(--sp-2);max-width:60ch">${D.rootCause}</p><div class="row gap-3" style="margin-top:var(--sp-3)">${conf(4, 'High')}<span class="t-meta">${Object.keys(EV).length} evidence items and 3 suspects will be kept</span></div></div>
  <section class="sec"><h2>What doesn't fit?</h2>
    <div class="field"><label for="ctx">Your context for Trace</label><textarea class="input" id="ctx" rows="3" style="height:auto;padding:var(--sp-2) var(--sp-3)" placeholder="For example: precision only dropped for online merchants">${esc(S.context)}</textarea><span class="field-msg">Trace tests this first, against all four sources.</span></div>
    <div class="chips" style="margin-top:var(--sp-3)">${['Precision only dropped for online merchants', 'Fraud ops say the drop started on Friday', 'Precision recovered only partly after the fix'].map(c => `<button class="chip" data-act="ctx" data-text="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  </section>
  ${actions('<a class="btn btn-ghost" href="#/root-cause">Keep the diagnosis</a>', '<button class="btn btn-primary" data-act="reinvest" id="reinvest" disabled>Start a new investigation</button>')}`;

// Models (sidebar)
V.models = () => `
  ${head('Models', '<span class="t-secondary">Models Trace watches.</span>')}
  <div class="card"><table class="table"><thead><tr><th scope="col">Model</th><th scope="col">Current version</th><th scope="col">Precision</th><th scope="col">Open cases</th></tr></thead><tbody>
    <tr><td class="primary">Card fraud model<span class="sub t-id">${D.model}</span></td><td><span class="tag mono">${D.version}</span> <span class="t-meta">since ${D.versionDate}</span></td><td>${S.decision === 'approved' ? shift(D.drop.now, '90.6%', 'good') : shift(D.drop.was, D.drop.now, 'bad')}</td><td><a href="#/investigate">${D.caseId}</a></td></tr>
    <tr><td class="primary">Chargeback model<span class="sub t-id">chargeback-lgbm</span></td><td><span class="tag mono">v3</span></td><td class="mono">88.7%</td><td class="t-meta">None</td></tr>
  </tbody></table></div>`;

// ---------- Merged screens ----------
const noHead = h => h.replace(/^\s*<div class="page-hd">[\s\S]*?<\/div><\/div><\/div>/, '');
const noActions = h => { const i = h.lastIndexOf('<div class="page-actions">'); return i < 0 ? h : h.slice(0, i); };
const _recheck = V.recheck, _root = V['root-cause'], _plan = V.plan, _approve = V.approve, _decided = V.decided, _watch = V.watch;

// Root cause = the diagnosis, then how Trace confirmed it across sources
V['root-cause'] = () => `${noActions(_root())}
  <section class="sec"><h2>How Trace confirmed it <small>cross-checked in three sources</small></h2>${noHead(noActions(_recheck())).replace(/<section class="sec"><h2>Where the value went<\/h2>/, '<section class="sec"><h2>Where the value went</h2>')}</section>
  ${actions(edgeLink('wrong', 'Challenge this diagnosis'), '<a class="btn btn-primary" href="#/approve">See the plan and decide</a>')}`;

// Decide = Trace's recommendation and Maya's approval on one screen
V.approve = () => `${head('Decide', caseSub())}
  ${noHead(noActions(_plan()))}
  <section class="sec"><h2>Your decision</h2>${noHead(_approve())}</section>`;

// Watching = confirmation of the decision, then the monitoring outcome
V.watch = () => S.decision === 'approved'
  ? _watch().replace('<div class="alert banner-alert" data-tone="info"', `<div class="alert banner-alert" data-tone="success" style="margin-bottom:var(--sp-3)">${ic('shieldCheck')}<div><b>You approved the plan, Mon 9 Nov 09:05</b><p>Change request ${D.cr} went to the ${D.owner}, who applied the fix at 14:00. Trace didn’t change production itself.</p></div><div class="actions"></div></div><div class="alert banner-alert" data-tone="info"`)
  : _decided().replace('<h1 class="t-page">Decided</h1>', '<h1 class="t-page">Watching</h1>');
delete V.recheck; delete V.plan; delete V.decided;

/* =========================================================
   5. AGENT PANEL: one short message per screen, plus Maya's thread
   ========================================================= */
const SAY = {
  cases: 'I opened FR-2611 at 08:30 when Model Monitoring flagged the drop. A quick check says it\'s real, so I\'d like to investigate.',
  investigate: () => S.run === 'done' ? 'I found three possible causes. One is clearly ahead.' : S.run === 'running' ? 'Reading the sources now. You can keep working; I\'ll show each finding as it lands.' : 'Here\'s my plan. I only read the sources; nothing changes until you approve something.',
  suspects: 'S1 is the strongest: three sources agree. S2 doesn\'t fit the timing. Challenge any of them below.',
  recheck: 'Three independent sources confirm S1. The only gap is bank chargebacks, due Wednesday.',
  'root-cause': 'I\'m confident in this diagnosis. If Wednesday\'s chargebacks disagree with the analysts\' reviews, I\'ll reopen it.',
  plan: 'Fix the cause, not the symptom. A rollback wouldn\'t help, because v13 reads the same field.',
  approve: 'I recommend fixing the cause, not the model. This is your call; nothing changes until you decide.',
  decided: () => S.decision === 'rejected' ? 'Understood. Nothing has changed, and your reason is in the record.' : 'Recorded. I haven\'t changed anything in production; the Data Platform team applies the fix.',
  watch: () => S.decision === 'approved' ? 'Precision is recovering since the fix went in at 14:00. I\'ll keep watching until Wednesday.' : S.decision === 'rejected' ? 'Nothing has changed, and your reason is in the record.' : 'I start watching once you approve a fix.',
  record: 'Everything that happened in this case, including your input, in order.',
  'low-confidence': 'I can\'t be sure yet. Without the pipeline logs I can\'t tell a renamed field from a failed job.',
  conflict: 'Two sources disagree. I\'d rather understand why than trust either one.',
  wrong: 'Tell me what doesn\'t fit. I\'ll keep everything we\'ve found and test your context first.',
  models: 'fraud-xgb is the only model with an open case.'
};
const REPLY = {
  suspects: 'I checked Friday\'s rule change against the timing. It started at 17:00 on Friday, nine hours before the drop, and touches 2% of transactions, so S1 stays first.',
  'root-cause': 'Fair challenge. Use “Challenge this diagnosis” and I\'ll start a new investigation that keeps everything so far.',
  approve: 'The fix is a single mapping and can be removed in minutes. The diagnosis rests on three sources; only the bank chargebacks are outstanding.'
};
const DEFAULT_REPLY = 'Noted. I checked it against the evidence. It doesn\'t change the current finding, and it\'s now in the decision record.';

function renderPanel(route) {
  const say = typeof SAY[route] === 'function' ? SAY[route]() : SAY[route];
  const thread = (S.threads[route] || []).map(m => m.who === 'maya'
    ? `<div class="msg human fade-in"><span class="avatar">MR</span><div><div class="msg-hd"><b>Maya Rao</b><span class="kind">${m.kind || 'Note'}</span></div><div class="msg-bd">${esc(m.text)}</div></div></div>`
    : `<div class="msg agent fade-in"><span class="avatar agent">${ic('trace')}</span><div><div class="msg-hd"><b>Trace</b></div><div class="msg-bd">${esc(m.text)}</div></div></div>`).join('');
  const recent = S.events.slice(-3).reverse().map(e => `<li class="act" data-state="${e.who === 'maya' ? 'human' : 'completed'}"><span class="act-ic">${ic(e.who === 'maya' ? 'user' : e.who === 'agent' ? 'check' : 'bell')}</span><div><b>${esc((e.by ? e.by + ' ' : '') + e.title)}</b><small>${e.t}</small></div></li>`).join('');
  document.getElementById('ap-bd').innerHTML = `<p class="ap-say">${say}</p>${thread ? `<div class="thread">${thread}</div>` : ''}<div class="ap-sec"><h3>Latest in this case</h3><ol class="activity">${recent}</ol></div>`;
  document.getElementById('ask-hint').textContent = route === 'suspects' ? 'Try: “What about Friday\'s rule change?”' : '';
}

/* =========================================================
   6. SHELL: top bar, steps, sidebar
   ========================================================= */
function renderShell(route) {
  const edge = EDGES[route];
  const stepRoute = edge ? edge[0] : route;
  const idx = STEPS.findIndex(s => s[0] === stepRoute);
  const inCase = route !== 'cases' && route !== 'models';

  document.getElementById('crumbs').innerHTML = inCase
    ? `<a href="#/cases">Cases</a><span class="sep">/</span><span class="t-id">${D.caseId}</span><span class="sep">/</span><span aria-current="page">${TITLES[route]}</span>`
    : `<span aria-current="page">${TITLES[route]}</span>`;

  // Trace's live status sits in the panel header, next to its name
  const busy = S.run === 'running' || S.conflict === 'resolving';
  const waiting = route === 'approve' && !S.decision;
  document.getElementById('ap-hd').dataset.state = busy ? 'busy' : waiting ? 'waiting' : 'idle';
  document.getElementById('ap-state').textContent = busy ? 'Investigating' : waiting ? 'Waiting for your decision' : S.decision === 'approved' ? 'Watching fraud-xgb' : 'Ready';

  const steps = document.getElementById('steps');
  steps.hidden = !inCase;
  if (inCase) {
    const prev = edge ? edge[0] : idx > 0 ? STEPS[idx - 1][0] : 'cases';
    const next = !edge && idx >= 0 && idx < STEPS.length - 1 ? STEPS[idx + 1][0] : null;
    const nextBlocked = (route === 'investigate' && S.run !== 'done') || (route === 'approve' && !S.decision) || (route === 'decided' && S.decision !== 'approved');
    steps.innerHTML = `<a class="btn btn-ghost btn-sm" href="#/${prev}">${ic('chevLeft')}Back</a>
      <ol aria-label="Investigation steps">${STEPS.map(([r, t], i) => {
        const done = i < idx || (i <= S.reached && i !== idx);
        const reach = i <= Math.max(S.reached, idx);
        return `<li><button class="step-btn${done ? ' done' : ''}" data-go="${r}" title="${t}" aria-label="Step ${i + 1}: ${t}${done ? ', completed' : ''}" ${i === idx ? 'aria-current="step"' : ''} ${reach ? '' : 'disabled'}><span class="n">${done ? ic('check') : i + 1}</span><span class="lbl">${t}</span></button></li>`;
      }).join('')}</ol>
      ${edge ? `<span class="tag" style="border-style:dashed">${ic('branch')}Edge case: ${edge[1]}</span>` : next ? `<a class="btn btn-ghost btn-sm" href="#/${next}" ${nextBlocked ? 'aria-disabled="true" tabindex="-1" style="opacity:.45;pointer-events:none"' : ''}>Next${ic('chevRight')}</a>` : '<span style="width:64px"></span>'}`;
  }

  const navKey = route === 'cases' ? 'cases' : route === 'models' ? 'models' : route === 'record' ? 'activity' : 'investigations';  // 'investigations' = inside the current case
  document.querySelectorAll('[data-nav]').forEach(a => a.dataset.nav === navKey ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  // Investigations: say which case and step it returns to
  const cur = (STEPS[Math.max(0, S.reached)] || STEPS[0]);
  const curHref = '#/' + (S.reached < 0 ? 'investigate' : cur[0]);
  const sub = document.getElementById('nav-current');
  sub.setAttribute('href', curHref);
  document.getElementById('nav-step').textContent = S.reached < 0 && S.run === 'idle' ? 'Not started' : S.run === 'running' ? 'Running' : (STEPS[Math.max(0, idx >= 0 ? idx : S.reached)] || cur)[1];
  navKey === 'investigations' ? sub.setAttribute('aria-current', 'page') : sub.removeAttribute('aria-current');
  sub.setAttribute('aria-label', `Current investigation, ${D.caseId}, ${document.getElementById('nav-step').textContent}`);
  // Cases: how many need Maya
  const need = S.decision || S.run === 'running' ? 0 : 1;
  const cnt = document.getElementById('nav-count');
  cnt.hidden = !need; cnt.textContent = need; cnt.title = `${need} case needs you`;
  // Connected sources: Data Pipeline Logs is offline in the low-confidence case
  const off = route === 'low-confidence' && !S.lowConfResolved;
  const pl = document.getElementById('src-pl');
  off ? pl.setAttribute('data-off', '') : pl.removeAttribute('data-off');
  pl.title = off ? 'Not responding' : 'Connected, read-only';
  ['src-mon', 'src-fs', 'src-mr'].forEach(id => { document.getElementById(id).title = 'Connected, read-only'; });
}

/* =========================================================
   7. ROUTER + RENDER
   ========================================================= */
function route() {
  let r = (location.hash.replace(/^#\/?/, '') || 'cases').split('/')[0];
  if (ALIAS[r]) { r = ALIAS[r]; history.replaceState(null, '', '#/' + r); }
  return V[r] && !ALIAS[r] ? r : 'cases';
}
let lastRoute = null;
function render() {
  const r = route();
  const idx = STEPS.findIndex(s => s[0] === r);
  if (idx > S.reached) S.reached = idx;
  logVisit(r);
  renderShell(r);
  const view = document.getElementById('view');
  view.classList.toggle('is-cases', r === 'cases');
  view.innerHTML = V[r]();
  renderPanel(r);
  TRACE.paint(document.getElementById('app'));
  bindView(r);
  if (r !== lastRoute) { document.getElementById('tbody').scrollTop = 0; view.focus({ preventScroll: true }); document.title = `${TITLES[r]}, TRACE`; }
  lastRoute = r;
  save();
}

// Visiting a screen for the first time records what Trace did there
function logVisit(r) {
  if (r === 'root-cause' && S.run === 'done') log('recheck', { t: 'Mon 9 Nov 08:44', who: 'agent', title: 'Trace confirmed S1 in three sources', what: 'Feature Store, Data Pipeline Logs and Model Registry agree', refs: ['e2', 'e3', 'e4'] });
  if (r === 'root-cause' && S.run === 'done') log('root', { t: 'Mon 9 Nov 08:47', who: 'agent', title: 'Trace stated the diagnosis', what: 'Column rename upstream emptied merchant_category. High confidence', refs: ['e3'] });
  if (r === 'approve' && S.run === 'done') log('plan', { t: 'Mon 9 Nov 08:49', who: 'agent', title: 'Trace proposed a plan', what: 'Restore the mapping and backfill. Proposed, not applied' });
  if (r === 'watch' && S.decision === 'approved') { log('fix', { t: 'Mon 9 Nov 14:00', who: 'system', by: 'Data Platform team', title: 'applied the mapping fix, CR-1187', what: 'Reported by Data Pipeline Logs' }); log('watch', { t: 'Tue 10 Nov 09:00', who: 'agent', title: 'Trace checkpoint: precision 90.6%', what: 'Recovering. Simulated outcome' }); }
}

/* =========================================================
   8. INTERACTIONS
   ========================================================= */
let timer = null;
function runInvestigation() {
  if (S.run !== 'idle') return;
  S.run = 'running'; S.runStep = 0;
  log(null, { t: 'Mon 9 Nov 08:32', who: 'maya', title: S.reinvest ? `Started investigation ${S.reinvest + 1}` : 'Started the investigation', what: S.reinvest ? `Context: ${S.context}` : '' });
  render();
  clearInterval(timer);
  timer = setInterval(() => {
    S.runStep++;
    if (S.runStep >= RUN.length) {
      clearInterval(timer); S.run = 'done';
      log(null, { t: 'Mon 9 Nov 08:36', who: 'agent', title: S.reinvest ? 'Trace tested Maya\'s context; the diagnosis holds' : 'Trace ranked three suspects', what: S.reinvest ? 'The rename affected online merchants most, which fits the context' : 'S1 schema change (high), S2 rule change (low), S3 bad release (ruled out)', refs: ['e2', 'e3'] });
    }
    if (route() === 'investigate') render(); else save();
  }, 650);
}

function bindView(r) {
  const view = document.getElementById('view');
  view.onclick = e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const a = t.dataset.act;
    if (a === 'start') runInvestigation();
    if (a === 'suspect') { S.suspect = t.dataset.id; render(); }
    if (a === 'node') { S.node = t.dataset.id; render(); }
    if (a === 'pb-fill') { S.pushText = PUSH_SUGGESTION; render(); document.getElementById('pb-text').focus(); }
    if (a === 'pb-send') {
      S.pushText = document.getElementById('pb-text').value.trim(); if (!S.pushText) return;
      S.pushback = 'checking'; S.suspect = 's2'; render();
      setTimeout(() => {
        S.pushback = 'done';
        log(null, { t: 'Mon 9 Nov 08:41', who: 'maya', title: 'Challenged the ranking', what: S.pushText });
        log(null, { t: 'Mon 9 Nov 08:42', who: 'agent', title: 'Trace re-checked and kept S1 first', what: 'The rule change started nine hours before the drop and touches 2% of payments', refs: ['e5', 'e1'] });
        render();
      }, 1400);
    }
    if (a === 'retry') { S.lowConfResolved = true; if (S.run !== 'done') { S.run = 'done'; S.runStep = RUN.length; } log('lowconf', { t: 'Mon 9 Nov 08:35', who: 'maya', title: 'Retried Data Pipeline Logs', what: 'The source responded; all four sources available' }); go('suspects'); }
    if (a === 'resolve') {
      S.conflict = 'resolving'; render();
      setTimeout(() => { S.conflict = 'resolved'; log('conflict', { t: 'Mon 9 Nov 08:40', who: 'agent', title: 'Trace explained conflicting evidence', what: 'Ingestion was clean, but under the new column name', refs: ['e6', 'e3'] }); render(); }, 1400);
    }
    if (a === 'more') { S.moreRequested = true; log('more', { t: 'Mon 9 Nov 09:02', who: 'maya', title: 'Requested further investigation', what: 'Trace re-ran cross-checks; result unchanged' }); go('recheck'); }
    if (a === 'approve') { S.decision = 'approved'; S.rejectReason = document.getElementById('ap-note').value.trim(); log('decision', { t: 'Mon 9 Nov 09:05', who: 'maya', title: 'Approved the plan', what: S.rejectReason || 'Restore the mapping and backfill, via CR-1187' }); go('decided'); }
    if (a === 'reject') {
      const note = document.getElementById('ap-note').value.trim();
      if (!note) { const f = document.getElementById('ap-note'); f.closest('.field').classList.add('invalid'); f.setAttribute('aria-invalid', 'true'); document.getElementById('ap-msg').innerHTML = ic('alert') + 'Add a reason so the decision record explains the rejection'; TRACE.paint(view); f.focus(); return; }
      S.decision = 'rejected'; S.rejectReason = note; log('decision', { t: 'Mon 9 Nov 09:05', who: 'maya', title: 'Rejected the plan', what: note }); go('decided');
    }
    if (a === 'replan') { S.decision = null; S.rejectReason = ''; delete S.logged.decision; go('plan'); }
    if (a === 'ctx') { const f = document.getElementById('ctx'); f.value = t.dataset.text; f.dispatchEvent(new Event('input')); f.focus(); }
    if (a === 'reinvest') {
      S.context = document.getElementById('ctx').value.trim();
      log(null, { t: 'Mon 9 Nov 09:10', who: 'maya', title: 'Challenged the diagnosis', what: S.context });
      S.reinvest++; S.run = 'idle'; S.runStep = 0; S.decision = null; S.moreRequested = false; S.reached = 0;
      ['recheck', 'root', 'plan', 'decision', 'fix', 'watch'].forEach(k => delete S.logged[k]);
      go('investigate');
    }
    if (a === 'restart') restart();
  };
  // Approve unlocks only after the review box is ticked
  const chk = document.getElementById('ap-check');
  if (chk) chk.onchange = () => { document.getElementById('ap-approve').disabled = !chk.checked; };
  const note = document.getElementById('ap-note');
  if (note) note.oninput = () => { note.closest('.field').classList.remove('invalid'); note.removeAttribute('aria-invalid'); document.getElementById('ap-msg').textContent = ''; };
  const pb = document.getElementById('pb-text');
  if (pb) pb.oninput = () => { S.pushText = pb.value; document.getElementById('pb-send').disabled = !pb.value.trim(); };
  const ctx = document.getElementById('ctx');
  if (ctx) { const sync = () => { document.getElementById('reinvest').disabled = !ctx.value.trim(); }; ctx.oninput = sync; sync(); }
}

// Steps bar, citations and restart live outside the view
document.getElementById('steps').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b && !b.disabled) go(b.dataset.go); });
document.getElementById('view').addEventListener('click', e => {
  const c = e.target.closest('.cite[data-ev]'); if (!c) return;
  e.preventDefault();
  const id = c.dataset.ev; const sus = Object.entries(SUSPECTS).find(([, h]) => h.support.includes(id) || h.against.includes(id));
  if (sus) S.suspect = sus[0];
  go('suspects');
  setTimeout(() => { const el = document.getElementById('ev-' + id); if (el) { el.setAttribute('aria-current', 'true'); el.querySelector('details')?.setAttribute('open', ''); el.scrollIntoView({ block: 'center' }); } }, 60);
}, true);

function restart() { clearInterval(timer); S = fresh(); save(); if (route() === 'cases') render(); else go('cases'); }
// Restart lives outside the product, in the showcase viewer bar
window.TRACE_RESTART = restart;

// Agent panel composer: Maya can challenge or add context on any screen
const ask = document.getElementById('ask'), send = document.getElementById('send');
ask.oninput = () => { send.disabled = !ask.value.trim(); };
ask.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!send.disabled) send.click(); } };
send.onclick = () => {
  const r = route(), text = ask.value.trim(); if (!text) return;
  const th = S.threads[r] = S.threads[r] || [];
  th.push({ who: 'maya', text, kind: /why|wrong|what about|instead|really|sure/i.test(text) ? 'Challenge' : 'Note' });
  const reply = REPLY[r] || DEFAULT_REPLY;
  th.push({ who: 'agent', text: reply });
  log(null, { t: 'Mon 9 Nov 08:41', who: 'maya', title: th[th.length - 2].kind === 'Challenge' ? `Challenged on ${TITLES[r]}` : `Added context on ${TITLES[r]}`, what: text });
  ask.value = ''; send.disabled = true;
  render();
  const bd = document.getElementById('ap-bd'); bd.scrollTop = bd.scrollHeight;
};

window.addEventListener('hashchange', render);
render();
})();

/* TRACE · icons + status helper
   <i data-icon="name"></i>               → inline SVG from one 1.6px stroke set
   <span class="status" data-status="x">  → adds the status icon, and the default label if empty
   Call TRACE.paint(root) after inserting new markup. */
(function () {
  const P = {
    // navigation + ui
    cases:'<path d="M4 7h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 7l2-3h12l2 3M9 11h6"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    bell:'<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7M12 17h.01"/>',
    record:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    sidebar:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    chevDown:'<path d="M7 10l5 5 5-5"/>', chevRight:'<path d="M10 7l5 5-5 5"/>', chevLeft:'<path d="M14 7l-5 5 5 5"/>', chevUp:'<path d="M7 14l5-5 5 5"/>',
    arrowRight:'<path d="M5 12h14M13 6l6 6-6 6"/>', arrowUp:'<path d="M12 19V5M6 11l6-6 6 6"/>', arrowDown:'<path d="M12 5v14M6 13l6 6 6-6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    filter:'<path d="M4 6h16M7 12h10M10 18h4"/>', sort:'<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    external:'<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    zoomIn:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5"/>', zoomOut:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8.5 11h5"/>',
    fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    send:'<path d="M12 19V5M6 11l6-6 6 6"/>', paperclip:'<path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7-7L13 4.5a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.2a1.7 1.7 0 0 1-2.3-2.3L15 7.3"/>',
    at:'<circle cx="12" cy="12" r="3.5"/><path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.3 6.7"/>',
    message:'<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
    calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    history:'<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4M12 8v4l3 2"/>',
    undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    play:'<path d="M7 5l12 7-12 7z"/>', pause:'<path d="M8 5v14M16 5v14"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    // agent + reasoning
    // the agent: a path through evidence that ends on a target
    trace:'<path d="M3 20l4.5-5.5 4 3L15 13"/><circle cx="18" cy="9.5" r="3.5"/><path d="M18 3.5v1.5M18 14v1.5M12 9.5h1.5M22.5 9.5H24"/>',
    lens:'<circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5M7.5 10h5M10 7.5v5"/>',
    lightbulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    branch:'<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-6 3-12 7"/>',
    merge:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v4a8 8 0 0 0 8 8h2"/>',
    scale:'<path d="M12 4v16M5 20h14M5 8h14M5 8l-2.5 6h5zM19 8l-2.5 6h5z"/>',
    // source systems
    monitor:'<path d="M3 12h3.5l2.5-6 4 12 2.5-6H21"/>',
    database:'<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>',
    pipeline:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12.5 15H17"/>',
    registry:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    flask:'<path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 15h9"/>',
    chart:'<path d="M4 4v16h16"/><path d="M8 15l3.5-4 3 2.5L20 7"/>',
    // status
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    checkCircle:'<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.7L16 9.5"/>',
    loader:'<path d="M12 3a9 9 0 1 1-9 9"/>',
    review:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lowConf:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" opacity=".35"/><path d="M12 3v18"/>',
    conflict:'<path d="M7 4v6a5 5 0 0 0 5 5M17 4v6a5 5 0 0 1-5 5v5"/><path d="M4 7l3-3 3 3M14 7l3-3 3 3"/>',
    hourglass:'<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
    shieldCheck:'<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12l2.2 2.2 4.3-4.4"/>',
    xCircle:'<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    alert:'<path d="M12 4L2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    circleDash:'<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3"/>'
  };
  /* The one status vocabulary. Every pill, node, activity row and source reads its word and icon here.
     One word per state, no synonyms. */
  const STATUS = {
    // case + step
    'investigating':['loader','Investigating'],   // a case the agent is working on
    'running':['loader','Running'],               // one step the agent is running now
    'queued':['circleDash','Queued'],             // a step not started yet
    'completed':['checkCircle','Completed'],
    'failed':['alert','Failed'],
    'needs-review':['review','Needs review'],
    'low-confidence':['lowConf','Low confidence'],
    'conflicting':['conflict','Conflicting evidence'],
    'awaiting-approval':['hourglass','Awaiting approval'],
    'approved':['shieldCheck','Approved'],
    'rejected':['xCircle','Rejected'],
    'conditional':['branch','Conditional'],
    // hypotheses + evidence
    'testing':['loader','Testing'],               // a hypothesis Trace is checking now
    'leading':['target','Leading'],               // the hypothesis with the strongest evidence
    'ruled-out':['minus','Ruled out'],
    'supports':['check','Supports'],
    'contradicts':['x','Contradicts'],
    'missing':['circleDash','Missing'],
    'proposed':['circleDash','Proposed'],         // a recommendation, not yet applied
    'applied':['checkCircle','Applied'],
    // sources
    'connected':[null,'Connected'],
    'offline':[null,'Offline'],
    'read-only':[null,'Read-only']
  };
  const svg = (n, cls) => `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[n] || ''}</svg>`;
  function paint(root) {
    root = root || document;
    root.querySelectorAll('[data-status]:not([data-painted])').forEach(el => {
      const s = STATUS[el.dataset.status]; if (!s) return;
      if (!el.textContent.trim()) el.textContent = s[1];
      if (s[0]) el.insertAdjacentHTML('afterbegin', svg(s[0]));
      el.dataset.painted = '';
    });
    root.querySelectorAll('i[data-icon]').forEach(i => { i.outerHTML = svg(i.dataset.icon, i.className); });
  }
  window.TRACE = { icon: svg, paint, icons: Object.keys(P), statuses: STATUS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => paint()); else paint();
})();

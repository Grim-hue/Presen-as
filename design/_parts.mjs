export const CSS = `
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
  <style>
    *{box-sizing:border-box}
    /* One OKLCH ladder at hue 270, chroma .005-.008: grey that stays grey. */
    .sk{--bg:oklch(.16 .005 270);--side:oklch(.135 .005 270);--card:oklch(.195 .006 270);--elev:oklch(.225 .007 270);
        --line:oklch(.27 .008 270);--line2:oklch(.235 .007 270);
        --fg:oklch(.96 .003 270);--fg2:oklch(.84 .006 270);--fg3:oklch(.7 .008 270);--fg4:oklch(.55 .008 270);--fg5:oklch(.44 .008 270);
        --acc:oklch(.96 .003 270);--acc2:oklch(.96 .003 270);--accbg:oklch(.26 .008 270);--accln:oklch(.96 .003 270/.2);--accwash:rgba(255,255,255,.055);
        --monbg:rgba(255,255,255,.045);--monln:rgba(255,255,255,.2);--minibg:rgba(255,255,255,.1);
        --okbg:#10281f;--okfg:#34d399;--okln:rgba(52,211,153,.3);
        --wnbg:#2a2110;--wnfg:#fbbf24;--wnln:rgba(251,191,36,.3);
        --dnbg:#2a1518;--dnfg:#f87171;--dnln:rgba(248,113,113,.3);
        --inbg:#14202e;--infg:#60a5fa;--inln:rgba(96,165,250,.3);
        --mtbg:oklch(.235 .007 270);--hover:rgba(255,255,255,.028);--hover2:rgba(255,255,255,.05);--row:rgba(255,255,255,.018);
        --hatch:oklch(.21 .006 270);--field:oklch(.175 .005 270);--sqfg:#fff;--btnfg:oklch(.145 .005 270)}
    .sk.light{--bg:#f7f7f8;--side:#fff;--card:#fff;--elev:#f2f2f4;--line:#e2e2e6;--line2:#ececef;
        --fg:#16161a;--fg2:#3f3f47;--fg3:#6e6e78;--fg4:#8e8e99;--fg5:#a8a8b2;
        --acc:#16161a;--acc2:#16161a;--accbg:#ececef;--accln:rgba(22,22,26,.16);--accwash:rgba(0,0,0,.045);
        --monbg:rgba(0,0,0,.035);--monln:rgba(0,0,0,.16);--minibg:rgba(0,0,0,.08);
        --okbg:#e8f7f0;--okfg:#0f7a52;--okln:rgba(15,122,82,.26);
        --wnbg:#fdf4e3;--wnfg:#8a5a00;--wnln:rgba(138,90,0,.26);
        --dnbg:#fdecec;--dnfg:#b3261e;--dnln:rgba(179,38,30,.26);
        --inbg:#e9f1fd;--infg:#1c5fbe;--inln:rgba(28,95,190,.26);
        --mtbg:#f0f0f3;--hover:rgba(0,0,0,.03);--hover2:rgba(0,0,0,.055);--row:rgba(0,0,0,.016);
        --hatch:#e6e6ea;--field:#fafafb;--sqfg:#fff;--btnfg:#ffffff}
    body{margin:0;font-family:'IBM Plex Sans','Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
    a{color:var(--acc2);text-decoration:none}a:hover{color:var(--acc)}
    .ic{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
    .mono{font-family:'JetBrains Mono',ui-monospace,monospace}
    .app{display:flex;height:880px;background:var(--bg);color:var(--fg2)}
    .side{width:214px;flex-shrink:0;background:var(--side);border-right:1px solid var(--line2);display:flex;flex-direction:column;padding:18px 0}
    .brand{display:flex;align-items:center;gap:9px;padding:0 18px 22px;color:var(--fg)}
    .sect{padding:18px 18px 7px;font-size:9.5px;letter-spacing:.14em;color:var(--fg5);font-family:'JetBrains Mono',monospace}
    .nav{display:flex;flex-direction:column}
    .nav a{display:flex;align-items:center;gap:10px;padding:8px 18px;color:var(--fg3);font-size:12.5px;font-family:'JetBrains Mono',monospace;border-left:2px solid transparent}
    .nav a:hover{color:var(--fg);background:var(--hover)}
    .nav a.on{color:var(--fg);border-left-color:var(--acc);background:var(--accwash)}
    .nav a.on .ic{stroke:var(--acc2)}
    .me{margin-top:auto;padding:14px 18px 0;border-top:1px solid var(--line2);display:flex;align-items:center;gap:9px}
    .me i{width:24px;height:24px;border-radius:5px;background:#4f7fd8;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#fff;font-style:normal;font-family:'JetBrains Mono',monospace}
    .main{flex:1;display:flex;flex-direction:column;min-width:0}
    .top{height:54px;flex-shrink:0;border-bottom:1px solid var(--line2);display:flex;align-items:center;justify-content:space-between;padding:0 24px;gap:16px}
    .h1{font-size:14px;font-weight:600;color:var(--fg);letter-spacing:-.01em}
    .body{flex:1;padding:20px 24px;overflow:hidden;display:flex;flex-direction:column;min-height:0}
    .card{background:var(--card);border:1px solid var(--line);border-radius:8px}
    .btn{display:inline-flex;align-items:center;gap:7px;height:31px;padding:0 12px;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--fg2);font:500 12px 'JetBrains Mono',monospace;cursor:pointer}
    .btn:hover{background:var(--hover2);color:var(--fg)}
    .btn.pri{background:var(--acc);border-color:var(--acc);color:var(--btnfg)}
    .btn.pri:hover{background:var(--acc2)}
    .step{display:flex;align-items:center;border:1px solid var(--line);border-radius:6px;height:31px}
    .step button{background:none;border:none;color:var(--fg3);cursor:pointer;padding:0 9px;display:flex;height:100%;align-items:center}
    .step button:hover{color:var(--fg)}
    .step span{padding:0 12px;font:600 12.5px 'JetBrains Mono',monospace;color:var(--fg);border-left:1px solid var(--line);border-right:1px solid var(--line);line-height:29px}
    .tag{display:inline-flex;align-items:center;gap:5px;height:21px;padding:0 7px;border-radius:5px;font:500 10.5px 'JetBrains Mono',monospace;border:1px solid;letter-spacing:.02em}
    .t-ok{background:var(--okbg);color:var(--okfg);border-color:var(--okln)}
    .t-warn{background:var(--wnbg);color:var(--wnfg);border-color:var(--wnln)}
    .t-dang{background:var(--dnbg);color:var(--dnfg);border-color:var(--dnln)}
    .t-info{background:var(--inbg);color:var(--infg);border-color:var(--inln)}
    .t-acc{background:var(--acc);color:var(--btnfg);border-color:var(--acc)}
    .t-mut{background:var(--mtbg);color:var(--fg3);border-color:var(--line)}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;font:600 9.5px 'JetBrains Mono',monospace;letter-spacing:.13em;color:var(--fg4);padding:0 14px 9px}
    td{padding:10px 14px;border-top:1px solid var(--line2);font-size:12.5px;color:var(--fg2);vertical-align:middle}
    tr:hover td{background:var(--row)}
    .num{font-family:'JetBrains Mono',monospace}
    .sq{width:18px;height:18px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font:600 8px 'JetBrains Mono',monospace;color:var(--sqfg)}
    .who{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--fg2)}
    .icb{background:none;border:none;color:var(--fg4);cursor:pointer;padding:4px;display:inline-flex;border-radius:4px}
    .icb:hover{color:var(--fg);background:var(--hover2)}
    .banner{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:7px;font-size:12.5px;background:var(--wnbg);border:1px solid var(--wnln);color:var(--wnfg);margin-bottom:16px}
    .pse{height:15px;width:auto;opacity:.5;filter:brightness(0) invert(1)}
    .sk.light .pse{filter:brightness(0);opacity:.4}
    .foot{padding:13px 18px 0;margin-top:12px;border-top:1px solid var(--line2);display:flex;align-items:center;justify-content:space-between}
    .ver{font:400 9.5px 'JetBrains Mono',monospace;color:var(--fg5);letter-spacing:.06em}
    @keyframes dc-rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
    @keyframes dc-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    @keyframes dc-shim{100%{background-position:-200% 0}}
    .rise{animation:dc-rise .5s cubic-bezier(.22,1,.36,1) both}
    .grow{transform-origin:left;animation:dc-grow .85s cubic-bezier(.22,1,.36,1) both}
    .skl{background:linear-gradient(90deg,var(--elev) 25%,var(--line) 37%,var(--elev) 63%);background-size:200% 100%;animation:dc-shim 1.5s linear infinite;border-radius:4px}
    @media (prefers-reduced-motion:reduce){.rise,.grow,.skl{animation:none}.grow{transform:none}}
  </style>`;

const ICONS = {
  dash:'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  cal:'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/>',
  scale:'<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  plane:'<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  left:'<path d="m15 18-6-6 6-6"/>', right:'<path d="m9 18 6-6-6-6"/>',
  up:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  copy:'<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  spark:'<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
  warn:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  pencil:'<path d="M21.2 6.8a1 1 0 0 0-4-4L3.8 16.2a2 2 0 0 0-.5.8l-1.3 4.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5z"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  sheet:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
  chev:'<path d="m6 9 6 6 6-6"/>', dots:'<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
  out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
};
export const ico = (n, sz, extra) => {
  const st = [sz ? `width:${sz}px;height:${sz}px` : '', extra || ''].filter(Boolean).join(';');
  return `<svg class="ic"${st ? ` style="${st}"` : ''} viewBox="0 0 24 24">${ICONS[n]}</svg>`;
};

const NAV = [
  ['dash','Dashboard','dashboard'], ['cal','Plano','plano'], ['scale','Balanco','balanco'],
  ['plane','Ferias','ferias'], ['users','Equipa','equipa'], ['flag','Feriados','feriados']
];
export const side = (active) => `  <div class="side">
    <div class="brand">
      ${ico('cal', 19, 'stroke:var(--acc)')}
      <div>
        <div class="mono" style="font-size:13.5px;font-weight:700;letter-spacing:-.01em">PPI</div>
        <div class="mono" style="font-size:8.5px;letter-spacing:.06em;color:var(--fg5);margin-top:2px">Presenças nas Instalações</div>
      </div>
    </div>
    <div class="sect">PLANEAMENTO</div>
    <div class="nav">
${NAV.slice(0, 3).map(n => `      <a href="#"${n[2] === active ? ' class="on"' : ''}>${ico(n[0])}${n[1]}</a>`).join('\n')}
    </div>
    <div class="sect">DADOS</div>
    <div class="nav">
${NAV.slice(3).map(n => `      <a href="#"${n[2] === active ? ' class="on"' : ''}>${ico(n[0])}${n[1]}</a>`).join('\n')}
    </div>
    <div class="me">
      <i>AF</i>
      <div style="font-size:11px;color:var(--fg3)" class="mono">andre.freitas</div>
      <button class="icb" style="margin-left:auto">${ico('out', 15)}</button>
    </div>
    <div class="foot">
      <img class="pse" src="pse-logo.png" alt="PSE">
      <span class="ver">v0.1.0</span>
    </div>
  </div>`;

export const THEME_PROPS = `data-props='{"theme":{"editor":"enum","options":["escuro","claro"],"default":"escuro"}}'`;
export const THEME_VAL = "theme: (this.props.theme === 'claro' ? 'light' : 'dark')";
export const BASIC_LOGIC = `class Component extends DCLogic {
  renderVals() { return { ${THEME_VAL} }; }
}`;

export const page = ({ active, top, body, logic }) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>${CSS}
</helmet>
<div class="app sk {{theme}}">
${side(active)}
  <div class="main">
    <div class="top">
${top}
    </div>
    <div class="body">
${body}
    </div>
  </div>
</div>
</x-dc>
<script data-dc-script ${THEME_PROPS}>
${logic || BASIC_LOGIC}
</script>
</body>
</html>
`;

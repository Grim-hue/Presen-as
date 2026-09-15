import { writeFileSync } from 'node:fs';
import { page, ico, CSS, THEME_PROPS, BASIC_LOGIC } from './_parts.mjs';

const w = (f, s) => { writeFileSync(f, s); console.log('  ' + f + '  ' + s.length + ' bytes'); };
const M = { AF: ['André', '#4f7fd8'], TS: ['Tiago', '#8b5cf6'], JV: ['João', '#14b8a6'] };
const sq = (k) => `<span class="sq" style="background:${M[k][1]}">${k}</span>`;
const who = (k) => `<span class="who">${sq(k)}${M[k][0]}</span>`;

/* ---------------------------------------------------------------- Login */
w('Login.dc.html', `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>${CSS}
  <style>
    .wrap{height:880px;display:flex;align-items:center;justify-content:center;background:var(--bg);
      background-image:linear-gradient(var(--line2) 1px,transparent 1px),linear-gradient(90deg,var(--line2) 1px,transparent 1px);background-size:56px 56px}
    .lab{display:block;font:600 9.5px 'JetBrains Mono',monospace;letter-spacing:.13em;color:var(--fg4);margin:0 0 7px}
    .fld{display:flex;align-items:center;gap:9px;height:38px;padding:0 11px;border:1px solid var(--line);border-radius:6px;background:var(--field);color:var(--fg3);font-size:13px;margin-bottom:17px}
    .fld svg{stroke:var(--fg4)}
    .go{width:100%;height:38px;border:none;border-radius:6px;background:var(--acc);color:var(--btnfg);font:600 12.5px 'JetBrains Mono',monospace;cursor:pointer;letter-spacing:.03em}
    .go:hover{background:var(--acc2)}
  </style>
</helmet>
<div class="wrap sk {{theme}}">
  <div style="width:376px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:22px;padding-left:2px">
      ${ico('cal', 21, 'stroke:var(--acc)')}
      <span style="font:700 17px 'JetBrains Mono',monospace;color:var(--fg);letter-spacing:-.02em">PPI</span>
    </div>
    <div class="card" style="padding:30px 30px 26px">
      <div style="font-size:15px;font-weight:600;color:var(--fg);margin-bottom:4px">Iniciar sessão</div>
      <div style="font-size:12.5px;color:var(--fg3);margin-bottom:24px">Planeamento presencial da development team</div>
      <label class="lab">UTILIZADOR</label>
      <div class="fld">${ico('user', 15)}andre.freitas</div>
      <label class="lab">PALAVRA-PASSE</label>
      <div class="fld">${ico('lock', 15)}<span style="letter-spacing:.22em">••••••••••</span></div>
      <button class="go">ENTRAR</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;gap:13px;margin-top:22px">
      <img class="pse" style="height:17px" src="pse-logo.png" alt="PSE">
      <span class="ver">v0.1.0</span>
    </div>
  </div>
</div>
</x-dc>
<script data-dc-script ${THEME_PROPS}>
${BASIC_LOGIC}
</script>
</body>
</html>
`);

/* ------------------------------------------------------------ Dashboard */
const CALJS = `class Component extends DCLogic {
  constructor(props) { super(props); this.state = { p: 0 }; }
  componentDidMount() {
    const self = this, t0 = Date.now(), dur = 900;
    this.iv = setInterval(function () {
      const r = Math.min(1, (Date.now() - t0) / dur);
      self.setState({ p: 1 - Math.pow(1 - r, 3) });
      if (r >= 1) clearInterval(self.iv);
    }, 32);
  }
  componentWillUnmount() { clearInterval(this.iv); }
  renderVals() {
    const HOL = {'2026-1-1':'Ano Novo','2026-4-3':'Sexta-feira Santa','2026-4-5':'Páscoa','2026-4-25':'25 de Abril','2026-5-1':'Dia do Trabalhador','2026-6-4':'Corpo de Deus','2026-6-10':'Dia de Portugal','2026-6-13':'Santo António','2026-8-15':'Assunção','2026-10-5':'Implantação da República','2026-11-1':'Todos os Santos','2026-12-1':'Restauração','2026-12-8':'Imaculada','2026-12-25':'Natal'};
    const NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const T = [['AF','André','#4f7fd8'],['TS','Tiago','#8b5cf6'],['JV','João','#14b8a6']];
    let k = 0; const all = [];
    for (let m = 0; m < 12; m++) {
      const lead = (new Date(2026, m, 1).getDay() + 6) % 7;
      const dim = new Date(2026, m + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < lead; i++) cells.push({ key: 'b' + m + '-' + i, cls: 'blank', d: '', hol: '', i1: '', i2: '', n1: '', n2: '', c1: '', c2: '' });
      for (let d = 1; d <= dim; d++) {
        const hn = HOL['2026-' + (m + 1) + '-' + d] || '';
        const mon = new Date(2026, m, d).getDay() === 1;
        const c = { key: m + '-' + d, cls: hn ? 'hol' : '', d: d, hol: hn, i1: '', i2: '', n1: '', n2: '', c1: '', c2: '' };
        if (mon && !hn) {
          const on = T.filter(function (_, i) { return i !== k % 3; }); k++;
          c.cls = 'mon'; c.i1 = on[0][0]; c.n1 = on[0][1]; c.c1 = on[0][2];
          c.i2 = on[1][0]; c.n2 = on[1][1]; c.c2 = on[1][2];
        }
        cells.push(c);
      }
      all.push({ key: 'm' + m, name: NAMES[m], cells: cells });
    }
    const p = this.state.p;
    return { big: all[8], minis: all.slice(9, 12), n1: Math.round(41 * p), n2: Math.round(4 * p), theme: (this.props.theme === 'claro' ? 'light' : 'dark') };
  }
}`;

w('Main.dc.html', page({
  active: 'dashboard',
  top: `      <div class="h1">Dashboard</div>
      <div class="step">
        <button>${ico('left', 15)}</button><span>2026</span><button>${ico('right', 15)}</button>
      </div>`,
  body: `      <style>
        .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .st{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 15px;display:flex;align-items:center;justify-content:space-between}
        .st .k{font:600 9.5px 'JetBrains Mono',monospace;letter-spacing:.13em;color:var(--fg4);margin-bottom:6px}
        .st .v{font:500 21px 'JetBrains Mono',monospace;color:var(--fg);line-height:1}
        .cols{flex:1;display:flex;gap:16px;min-height:0}
        .bigc{flex:1;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px 18px 18px;display:flex;flex-direction:column;min-width:0}
        .bh{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
        .dow{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin-bottom:5px}
        .dow span{font:600 9.5px 'JetBrains Mono',monospace;letter-spacing:.1em;color:var(--fg5);padding-left:2px}
        .bgrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;flex:1}
        .bc{border:1px solid var(--elev);border-radius:5px;padding:6px 7px;display:flex;flex-direction:column;gap:3px;min-height:0}
        .bc.blank{border-color:transparent}
        .bd{font:500 12px 'JetBrains Mono',monospace;color:var(--fg4)}
        .bc.mon{border-color:var(--monln);background:var(--monbg)}
        .bc.mon .bd{color:var(--fg);font-weight:600}
        .bc.hol{background:repeating-linear-gradient(135deg,var(--hatch) 0 2px,transparent 2px 6px)}
        .bc.hol .bd{color:var(--fg5);text-decoration:line-through}
        .hn{font-size:8.5px;color:var(--fg4);line-height:1.25}
        .bc:not(.hol) .hn{display:none}
        .bw{display:flex;align-items:center;gap:4px;font-size:9.5px;color:var(--fg2)}
        .bw i{width:13px;height:13px;border-radius:3px;font:600 6.5px 'JetBrains Mono',monospace;display:flex;align-items:center;justify-content:center;color:var(--sqfg);font-style:normal;flex-shrink:0}
        .bc:not(.mon) .bw{display:none}
        .rail{width:266px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
        .mini{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 13px 14px;flex:1}
        .mini h3{margin:0 0 9px;font:600 10px 'JetBrains Mono',monospace;letter-spacing:.13em;color:var(--acc2);text-transform:uppercase}
        .mdow{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;margin-bottom:4px}
        .mdow span{text-align:center;font:400 8.5px 'JetBrains Mono',monospace;color:var(--fg5)}
        .mg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px}
        .mc{height:24px;border-radius:3px;display:flex;flex-direction:column;align-items:center;justify-content:center;font:400 10px 'JetBrains Mono',monospace;color:var(--fg4)}
        .mc.blank{visibility:hidden}
        .mc.hol{color:var(--fg5);text-decoration:line-through}
        .mc.mon{background:var(--minibg);color:var(--fg);font-weight:600}
        .mw{display:flex;gap:2px}
        .mw span{font:600 6.5px 'JetBrains Mono',monospace;color:var(--acc2)}
        .mc:not(.mon) .mw{display:none}
      </style>
      <div class="stats">
        <div class="st rise" style="animation-delay:0ms"><div><div class="k">PRÓXIMA SEGUNDA</div><div class="v" style="color:var(--acc2)">07 SET</div></div><div style="display:flex;flex-direction:column;gap:4px">${who('AF')}${who('TS')}</div></div>
        <div class="st rise" style="animation-delay:70ms"><div><div class="k">AS MINHAS SEGUNDAS</div><div class="v">{{n1}}</div></div><div style="font:400 11px 'JetBrains Mono',monospace;color:var(--fg4);text-align:right">de 40,7<br>esperadas</div></div>
        <div class="st rise" style="animation-delay:140ms"><div><div class="k">POR RESOLVER</div><div class="v" style="color:var(--wnfg)">{{n2}}</div></div><div style="font:400 11px 'JetBrains Mono',monospace;color:var(--fg4);text-align:right">segundas sem<br>2 elementos</div></div>
      </div>
      <div class="cols">
        <div class="bigc">
          <div class="bh">
            <div style="font-size:15px;font-weight:600;color:var(--fg)">{{big.name}} <span class="mono" style="color:var(--fg4);font-weight:400">2026</span></div>
            <div class="step" style="height:27px"><button>${ico('left', 14)}</button><span style="line-height:25px;font-size:11.5px">SET</span><button>${ico('right', 14)}</button></div>
          </div>
          <div class="dow"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span></div>
          <div class="bgrid">
            <sc-for list="{{big.cells}}" as="c" hint-placeholder-count="35">
              <div class="bc {{c.cls}}">
                <span class="bd">{{c.d}}</span>
                <span class="hn">{{c.hol}}</span>
                <span class="bw"><i style="background:{{c.c1}}">{{c.i1}}</i>{{c.n1}}</span>
                <span class="bw"><i style="background:{{c.c2}}">{{c.i2}}</i>{{c.n2}}</span>
              </div>
            </sc-for>
          </div>
        </div>
        <div class="rail">
          <sc-for list="{{minis}}" as="mo" hint-placeholder-count="3">
            <div class="mini">
              <h3>{{mo.name}}</h3>
              <div class="mdow"><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span><span>D</span></div>
              <div class="mg">
                <sc-for list="{{mo.cells}}" as="c" hint-placeholder-count="31">
                  <div class="mc {{c.cls}}"><span>{{c.d}}</span><span class="mw"><span>{{c.i1}}</span><span>{{c.i2}}</span></span></div>
                </sc-for>
              </div>
            </div>
          </sc-for>
        </div>
      </div>`,
  logic: CALJS
}));

/* ---------------------------------------------------------------- Plano */
const prow = (d, a, b, st, note) => `        <tr>
          <td class="num" style="color:var(--fg);font-weight:500">${d}</td>
          <td style="color:var(--fg3)">Segunda-feira</td>
          <td>${a ? `<div style="display:flex;gap:14px">${who(a)}${b ? who(b) : ''}</div>` : `<span style="color:var(--fg5)">—</span>`}</td>
          <td>${st}${note ? `<span style="color:var(--fg4);font-size:11.5px;margin-left:9px">${note}</span>` : ''}</td>
          <td style="text-align:right"><button class="icb">${ico('dots', 15)}</button></td>
        </tr>`;
const pgroup = (t) => `        <tr><td colspan="5" style="padding:16px 14px 7px;border-top:1px solid var(--line2)"><span class="mono" style="font-size:9.5px;letter-spacing:.14em;color:var(--acc2)">${t}</span></td></tr>`;

w('Plano.dc.html', page({
  active: 'plano',
  top: `      <div style="display:flex;align-items:center;gap:14px">
        <div class="h1">Plano</div>
        <span class="tag t-mut">SET — OUT 2026</span>
      </div>
      <div style="display:flex;gap:9px">
        <button class="btn">${ico('spark', 14)}GERAR</button>
        <button class="btn pri">${ico('copy', 14)}COPIAR EMAIL</button>
      </div>`,
  body: `      <div class="banner">${ico('warn', 16)}<span><b style="font-weight:600">1 segunda sem 2 elementos disponíveis.</b> 19 de outubro tem apenas o Tiago livre.</span></div>
      <div class="card" style="flex:1;overflow:hidden;display:flex;flex-direction:column">
        <table style="table-layout:fixed">
          <colgroup><col style="width:110px"><col style="width:180px"><col><col style="width:290px"><col style="width:56px"></colgroup>
          <thead><tr><th>DATA</th><th>DIA</th><th>ELEMENTOS</th><th>ESTADO</th><th></th></tr></thead>
          <tbody>
${pgroup('SETEMBRO 2026')}
${prow('07 set', 'AF', 'TS', '<span class="tag t-ok">CONFIRMADO</span>')}
${prow('14 set', 'TS', 'JV', '<span class="tag t-ok">CONFIRMADO</span>')}
${prow('21 set', 'AF', 'JV', '<span class="tag t-ok">CONFIRMADO</span>')}
${prow('28 set', 'AF', 'TS', '<span class="tag t-ok">CONFIRMADO</span>')}
${pgroup('OUTUBRO 2026')}
${prow('05 out', null, null, '<span class="tag t-mut">FERIADO</span>', 'Implantação da República')}
${prow('12 out', 'TS', 'JV', '<span class="tag t-ok">CONFIRMADO</span>')}
${prow('19 out', 'TS', null, '<span class="tag t-warn">1 DE 2</span>', 'André e João de férias')}
${prow('26 out', 'AF', 'TS', '<span class="tag t-ok">CONFIRMADO</span>')}
          </tbody>
        </table>
        <div style="margin-top:auto;border-top:1px solid var(--line2);padding:12px 14px;display:flex;align-items:center;justify-content:space-between">
          <span class="mono" style="font-size:11px;color:var(--fg4)">RASCUNHO · gerado há 2 minutos</span>
          <button class="btn pri">PUBLICAR PLANO</button>
        </div>
      </div>`
}));

/* -------------------------------------------------------------- Balanço */
const bcard = (k, done, exp, saldo, pct, sub, hot) => `        <div class="card rise" style="padding:16px 18px;flex:1;animation-delay:${70 * ['AF','TS','JV'].indexOf(k)}ms${hot ? ';border-color:var(--accln)' : ''}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <span class="who" style="font-size:13px;color:var(--fg)">${sq(k)}${M[k][0]} ${k === 'AF' ? 'Freitas' : k === 'TS' ? 'Sousa' : 'Vieira'}</span>
            ${hot ? '<span class="tag t-acc">PRÓXIMO</span>' : ''}
          </div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px">
            <span class="num" style="font-size:27px;color:var(--fg);line-height:1">${done}</span>
            <span class="num" style="font-size:12px;color:var(--fg4)">/ ${exp} esperadas</span>
          </div>
          <div style="height:5px;background:var(--elev);border-radius:3px;overflow:hidden;margin:12px 0 10px"><div class="grow" style="width:${pct}%;height:100%;background:${M[k][1]};animation-delay:${180 + 90 * ['AF','TS','JV'].indexOf(k)}ms"></div></div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="mono" style="font-size:11px;color:var(--fg4)">${sub}</span>
            <span class="tag ${saldo.startsWith('+') ? 't-acc' : 't-mut'}">SALDO ${saldo}</span>
          </div>
        </div>`;

w('Balanco.dc.html', page({
  active: 'balanco',
  top: `      <div style="display:flex;align-items:center;gap:14px">
        <div class="h1">Balanço</div>
        <span class="tag t-mut">DESDE 01 JAN 2026</span>
      </div>
      <span class="mono" style="font-size:11px;color:var(--fg4)">102 presenças atribuídas · 51 segundas úteis</span>`,
  body: `      <div style="display:flex;gap:12px;margin-bottom:16px">
${bcard('AF', '41', '40,7', '−0,3', 100, 'Desde 01 jan', false)}
${bcard('TS', '40', '40,7', '+0,7', 97, 'Desde 01 jan', true)}
${bcard('JV', '21', '20,6', '−0,4', 51, 'Entrou 01 jun', false)}
      </div>
      <div class="card" style="flex:1;display:flex;flex-direction:column;overflow:hidden">
        <table>
          <thead><tr><th>ELEMENTO</th><th>ENTRADA</th><th style="text-align:right">SEGUNDAS</th><th style="text-align:right">ESPERADAS</th><th style="text-align:right">SALDO</th><th>ÚLTIMA PRESENÇA</th></tr></thead>
          <tbody>
            <tr><td>${who('AF')}</td><td class="num" style="color:var(--fg3)">01/01/2026</td><td class="num" style="text-align:right;color:var(--fg)">41</td><td class="num" style="text-align:right;color:var(--fg3)">40,7</td><td class="num" style="text-align:right;color:var(--fg3)">−0,3</td><td class="num" style="color:var(--fg3)">28 set 2026</td></tr>
            <tr><td>${who('TS')}</td><td class="num" style="color:var(--fg3)">01/01/2026</td><td class="num" style="text-align:right;color:var(--fg)">40</td><td class="num" style="text-align:right;color:var(--fg3)">40,7</td><td class="num" style="text-align:right;color:var(--acc2);font-weight:500">+0,7</td><td class="num" style="color:var(--fg3)">28 set 2026</td></tr>
            <tr><td>${who('JV')}</td><td class="num" style="color:var(--fg3)">01/06/2026</td><td class="num" style="text-align:right;color:var(--fg)">21</td><td class="num" style="text-align:right;color:var(--fg3)">20,6</td><td class="num" style="text-align:right;color:var(--fg3)">−0,4</td><td class="num" style="color:var(--fg3)">21 set 2026</td></tr>
          </tbody>
        </table>
        <div style="margin-top:auto;border-top:1px solid var(--line2);padding:13px 14px;font-size:12px;color:var(--fg3);line-height:1.5">
          Cada elemento acumula uma quota nas segundas em que esteve disponível. Quem tiver maior saldo em dívida é escolhido primeiro,
          por isso quem entra a meio do ano não fica a dever as segundas anteriores à entrada.
        </div>
      </div>`
}));

/* --------------------------------------------------------------- Férias */
const frow = (k, ini, fim, dias, tipo, org) => `            <tr>
              <td>${who(k)}</td>
              <td class="num" style="color:var(--fg2)">${ini}</td>
              <td class="num" style="color:var(--fg2)">${fim}</td>
              <td class="num" style="text-align:right;color:var(--fg3)">${dias}</td>
              <td><span class="tag t-mut">${tipo}</span></td>
              <td>${org}</td>
              <td style="text-align:right;white-space:nowrap"><button class="icb">${ico('pencil', 14)}</button><button class="icb">${ico('trash', 14)}</button></td>
            </tr>`;

w('Ferias.dc.html', page({
  active: 'ferias',
  top: `      <div class="h1">Férias</div>
      <div style="display:flex;gap:9px">
        <button class="btn">${ico('plus', 14)}ADICIONAR</button>
        <button class="btn pri">${ico('up', 14)}IMPORTAR EXCEL</button>
      </div>`,
  body: `      <style>
        .tabs{display:flex;gap:2px;border-bottom:1px solid var(--line2);margin-bottom:14px}
        .tab{background:none;border:none;border-bottom:2px solid transparent;padding:0 14px 11px;color:var(--fg3);font:500 12.5px 'JetBrains Mono',monospace;cursor:pointer;display:flex;align-items:center;gap:7px;margin-bottom:-1px}
        .tab:hover{color:var(--fg)}
        .tab.on{color:var(--fg);border-bottom-color:var(--acc)}
        .tab b{font:600 9.5px 'JetBrains Mono',monospace;background:var(--elev);border-radius:9px;padding:2px 6px;color:var(--fg3)}
        .tab.on b{background:var(--accbg);color:var(--fg)}
        .filters{display:flex;gap:9px;margin-bottom:14px}
        .sel{display:flex;align-items:center;gap:8px;height:31px;padding:0 11px;border:1px solid var(--line);border-radius:6px;font:400 12px 'JetBrains Mono',monospace;color:var(--fg3)}
        .sel svg{stroke:var(--fg4)}
        .chead{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .leg{display:flex;gap:16px}
        .leg span{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--fg2)}
        .leg i{width:11px;height:11px;border-radius:3px;font-style:normal}
        .cdow{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin-bottom:5px}
        .cdow span{font:600 9.5px 'JetBrains Mono',monospace;letter-spacing:.1em;color:var(--fg5);padding-left:3px}
        .cg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;flex:1;min-height:0}
        .cc{border:1px solid var(--line2);border-radius:5px;padding:5px 5px 6px;display:flex;flex-direction:column;gap:3px;min-height:0}
        .cc.blank{border-color:transparent}
        .cch{display:flex;align-items:center;justify-content:space-between;height:13px;margin-bottom:1px}
        .ccd{font:500 11.5px 'JetBrains Mono',monospace;color:var(--fg4)}
        .cct{font:600 8px 'JetBrains Mono',monospace;letter-spacing:.1em;color:var(--fg3)}
        .cc.mon{border-color:var(--monln);background:var(--monbg)}
        .cc.mon .ccd{color:var(--fg);font-weight:600}
        .cc.mon .cct{color:var(--fg2)}
        .cc.short{border-color:var(--wnln);background:var(--wnbg)}
        .cc.short .cct{color:var(--wnfg)}
        .cc.hol{background:repeating-linear-gradient(135deg,var(--hatch) 0 2px,transparent 2px 6px)}
        .cc.hol .ccd{color:var(--fg5);text-decoration:line-through}
        .cc.hol .cct{color:var(--fg5)}
        .ab{height:15px;border-radius:3px;display:flex;align-items:center;padding:0 5px;font:600 8.5px 'JetBrains Mono',monospace;color:var(--fg);border-left:2px solid;flex-shrink:0}
        .ab.off{visibility:hidden}
      </style>
      <div class="tabs">
        <button class="{{clsCal}}" onClick="{{goCal}}">CALENDÁRIO</button>
        <button class="{{clsLst}}" onClick="{{goLst}}">LISTA <b>12</b></button>
        <button class="{{clsImp}}" onClick="{{goImp}}">IMPORTAÇÕES <b>3</b></button>
      </div>

      <sc-if value="{{isCal}}" hint-placeholder-val="{{true}}">
        <div style="display:flex;flex-direction:column;flex:1;min-height:0">
          <div class="chead">
            <div style="display:flex;align-items:center;gap:14px">
              <div class="step"><button>${ico('left', 15)}</button><span>AGOSTO 2026</span><button>${ico('right', 15)}</button></div>
              <span class="tag t-warn">3 SEGUNDAS SEM 2 ELEMENTOS</span>
            </div>
            <div class="leg">
              <span><i style="background:#4f7fd8"></i>André</span>
              <span><i style="background:#8b5cf6"></i>Tiago</span>
              <span><i style="background:#14b8a6"></i>João</span>
            </div>
          </div>
          <div class="cdow"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span></div>
          <div class="cg">
            <sc-for list="{{cells}}" as="c" hint-placeholder-count="36">
              <div class="cc {{c.cls}}">
                <div class="cch"><span class="ccd">{{c.d}}</span><span class="cct">{{c.tag}}</span></div>
                <sc-for list="{{c.slots}}" as="s" hint-placeholder-count="3">
                  <div class="ab {{s.cls}}" style="background:{{s.bg}};border-left-color:{{s.c}}">{{s.n}}</div>
                </sc-for>
              </div>
            </sc-for>
          </div>
        </div>
      </sc-if>

      <sc-if value="{{isLst}}" hint-placeholder-val="{{false}}">
        <div style="display:flex;flex-direction:column;flex:1;min-height:0">
          <div class="filters">
            <span class="sel">Todos os elementos ${ico('chev', 13)}</span>
            <span class="sel">2026 ${ico('chev', 13)}</span>
            <span class="sel">Todas as origens ${ico('chev', 13)}</span>
          </div>
          <div class="card" style="flex:1;overflow:hidden">
            <table style="table-layout:fixed">
              <colgroup><col><col style="width:120px"><col style="width:120px"><col style="width:70px"><col style="width:100px"><col style="width:150px"><col style="width:86px"></colgroup>
              <thead><tr><th>ELEMENTO</th><th>INÍCIO</th><th>FIM</th><th style="text-align:right">DIAS</th><th>TIPO</th><th>ORIGEM</th><th></th></tr></thead>
              <tbody>
${frow('AF', '03/08/2026', '21/08/2026', '15', 'FÉRIAS', '<span class="tag t-ok">EXCEL</span>')}
${frow('TS', '10/08/2026', '28/08/2026', '15', 'FÉRIAS', '<span class="tag t-ok">EXCEL</span>')}
${frow('JV', '17/08/2026', '04/09/2026', '15', 'FÉRIAS', '<span class="tag t-warn">EXCEL · EDITADO</span>')}
${frow('AF', '12/10/2026', '23/10/2026', '10', 'FÉRIAS', '<span class="tag t-ok">EXCEL</span>')}
${frow('JV', '19/10/2026', '19/10/2026', '1', 'OUTRO', '<span class="tag t-info">MANUAL</span>')}
${frow('TS', '21/12/2026', '31/12/2026', '7', 'FÉRIAS', '<span class="tag t-info">MANUAL</span>')}
              </tbody>
            </table>
          </div>
        </div>
      </sc-if>

      <sc-if value="{{isImp}}" hint-placeholder-val="{{false}}">
        <div class="card" style="flex:1;overflow:hidden">
          <table style="table-layout:fixed">
            <colgroup><col><col style="width:170px"><col style="width:90px"><col style="width:210px"><col style="width:86px"></colgroup>
            <thead><tr><th>FICHEIRO</th><th>CARREGADO</th><th style="text-align:right">LINHAS</th><th>ESTADO</th><th></th></tr></thead>
            <tbody>
              <tr>
                <td><span class="who">${ico('sheet', 15, 'stroke:var(--okfg)')}ferias_2026_v3.xlsx</span></td>
                <td class="num" style="color:var(--fg3)">28/08/2026 14:02</td>
                <td class="num" style="text-align:right">18</td>
                <td><span class="tag t-warn">3 CONFLITOS</span></td>
                <td style="text-align:right"><button class="icb">${ico('dots', 15)}</button></td>
              </tr>
              <tr>
                <td><span class="who">${ico('sheet', 15, 'stroke:var(--fg4)')}ferias_2026_v2.xlsx</span></td>
                <td class="num" style="color:var(--fg3)">12/06/2026 09:31</td>
                <td class="num" style="text-align:right">17</td>
                <td><span class="tag t-ok">APLICADO</span></td>
                <td style="text-align:right"><button class="icb">${ico('dots', 15)}</button></td>
              </tr>
              <tr>
                <td><span class="who">${ico('sheet', 15, 'stroke:var(--fg4)')}ferias_2026.xlsx</span></td>
                <td class="num" style="color:var(--fg3)">04/02/2026 11:20</td>
                <td class="num" style="text-align:right">15</td>
                <td><span class="tag t-ok">APLICADO</span></td>
                <td style="text-align:right"><button class="icb">${ico('dots', 15)}</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </sc-if>`,
  logic: `class Component extends DCLogic {
  constructor(props) { super(props); this.state = { tab: 'cal' }; }
  renderVals() {
    const self = this, t = this.state.tab;
    const TEAM = [['AF','André','#4f7fd8','rgba(79,127,216,.22)'],['TS','Tiago','#8b5cf6','rgba(139,92,246,.22)'],['JV','João','#14b8a6','rgba(20,184,166,.22)']];
    const ABS = { AF: [['2026-08-03','2026-08-21']], TS: [['2026-08-10','2026-08-28']], JV: [['2026-08-17','2026-09-04']] };
    const iso = function (d) { return '2026-08-' + (d < 10 ? '0' + d : d); };
    const away = function (k, d) { return ABS[k].some(function (r) { return iso(d) >= r[0] && iso(d) <= r[1]; }); };
    const lead = (new Date(2026, 7, 1).getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push({ key: 'b' + i, cls: 'blank', d: '', tag: '', slots: [] });
    for (let d = 1; d <= 31; d++) {
      const mon = new Date(2026, 7, d).getDay() === 1;
      const hol = d === 15;
      const free = TEAM.filter(function (m) { return !away(m[0], d); }).length;
      let cls = '', tag = '';
      if (hol) { cls = 'hol'; tag = 'FERIADO'; }
      else if (mon) { cls = free < 2 ? 'mon short' : 'mon'; tag = free < 2 ? free + ' DE 2' : 'SEGUNDA'; }
      cells.push({
        key: 'd' + d, cls: cls, d: d, tag: tag,
        slots: TEAM.map(function (m) {
          return { key: 's' + d + m[0], cls: away(m[0], d) ? 'ab' : 'ab off', n: m[1], c: m[2], bg: m[3] };
        })
      });
    }
    return {
      theme: (this.props.theme === 'claro' ? 'light' : 'dark'),
      cells: cells,
      isCal: t === 'cal', isLst: t === 'lst', isImp: t === 'imp',
      clsCal: t === 'cal' ? 'tab on' : 'tab',
      clsLst: t === 'lst' ? 'tab on' : 'tab',
      clsImp: t === 'imp' ? 'tab on' : 'tab',
      goCal: function () { self.setState({ tab: 'cal' }); },
      goLst: function () { self.setState({ tab: 'lst' }); },
      goImp: function () { self.setState({ tab: 'imp' }); }
    };
  }
}`
}));

/* --------------------------------------------------------------- Equipa */
const fld = (lab, val, chev) => `          <div style="flex:1">
            <div style="font:600 9.5px 'JetBrains Mono',monospace;letter-spacing:.13em;color:var(--fg4);margin-bottom:8px">${lab}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;height:36px;padding:0 12px;border:1px solid var(--line);border-radius:6px;background:var(--field);font-size:13px;color:var(--fg)">${val}${chev ? ico('chev', 14) : ''}</div>
          </div>`;

w('Equipa.dc.html', page({
  active: 'equipa',
  top: `      <div class="h1">Equipa</div>
      <button class="btn">${ico('plus', 14)}ADICIONAR ELEMENTO</button>`,
  body: `      <div class="card" style="padding:18px 20px;margin-bottom:16px">
        <div style="font-size:13.5px;font-weight:600;color:var(--fg);margin-bottom:3px">Regra de presença</div>
        <div style="font-size:12px;color:var(--fg3);margin-bottom:18px">Define o que o gerador de planos tem de garantir.</div>
        <div style="display:flex;gap:14px">
${fld('DIA PRESENCIAL', 'Segunda-feira', true)}
${fld('ELEMENTOS NECESSÁRIOS', '2', true)}
${fld('SALDO CONTADO DESDE', '01/01/2026', false)}
        </div>
      </div>
      <div class="card" style="flex:1;overflow:hidden">
        <table style="table-layout:fixed">
          <colgroup><col style="width:220px"><col><col style="width:130px"><col style="width:110px"><col style="width:150px"><col style="width:86px"></colgroup>
          <thead><tr><th>ELEMENTO</th><th>EMAIL</th><th>ENTRADA</th><th>SAÍDA</th><th>PERFIL</th><th></th></tr></thead>
          <tbody>
            <tr><td>${who('AF')} Freitas</td><td class="num" style="color:var(--fg3)">andre.freitas@pse.pt</td><td class="num" style="color:var(--fg2)">01/01/2026</td><td style="color:var(--fg5)">—</td><td><span class="tag t-acc">ADMINISTRADOR</span></td><td style="text-align:right"><button class="icb">${ico('pencil', 14)}</button></td></tr>
            <tr><td>${who('TS')} Sousa</td><td class="num" style="color:var(--fg3)">tiago.sousa@pse.pt</td><td class="num" style="color:var(--fg2)">01/01/2026</td><td style="color:var(--fg5)">—</td><td><span class="tag t-mut">ELEMENTO</span></td><td style="text-align:right"><button class="icb">${ico('pencil', 14)}</button></td></tr>
            <tr><td>${who('JV')} Vieira</td><td class="num" style="color:var(--fg3)">joao.vieira@pse.pt</td><td class="num" style="color:var(--fg2)">01/06/2026</td><td style="color:var(--fg5)">—</td><td><span class="tag t-mut">ELEMENTO</span></td><td style="text-align:right"><button class="icb">${ico('pencil', 14)}</button></td></tr>
          </tbody>
        </table>
      </div>`
}));

/* ------------------------------------------------------------- Feriados */
const HOLS = [
  ['01 jan', 'Quinta-feira', 'Ano Novo', 1], ['03 abr', 'Sexta-feira', 'Sexta-feira Santa', 1],
  ['05 abr', 'Domingo', 'Páscoa', 1], ['25 abr', 'Sábado', 'Dia da Liberdade', 1],
  ['01 mai', 'Sexta-feira', 'Dia do Trabalhador', 1], ['04 jun', 'Quinta-feira', 'Corpo de Deus', 1],
  ['10 jun', 'Quarta-feira', 'Dia de Portugal', 1], ['13 jun', 'Sábado', 'Santo António', 0],
  ['15 ago', 'Sábado', 'Assunção de Nossa Senhora', 1], ['05 out', 'Segunda-feira', 'Implantação da República', 1],
  ['01 nov', 'Domingo', 'Todos os Santos', 1], ['01 dez', 'Terça-feira', 'Restauração da Independência', 1],
  ['08 dez', 'Terça-feira', 'Imaculada Conceição', 1], ['25 dez', 'Sexta-feira', 'Natal', 1]
];
w('Feriados.dc.html', page({
  active: 'feriados',
  top: `      <div style="display:flex;align-items:center;gap:14px">
        <div class="h1">Feriados</div>
        <span class="tag t-acc">1 CAI À SEGUNDA</span>
      </div>
      <div style="display:flex;gap:9px;align-items:center">
        <div class="step"><button>${ico('left', 15)}</button><span>2026</span><button>${ico('right', 15)}</button></div>
        <button class="btn">${ico('spark', 14)}GERAR ANO</button>
      </div>`,
  body: `      <div class="card" style="flex:1;overflow:hidden">
        <table style="table-layout:fixed">
          <colgroup><col style="width:120px"><col style="width:180px"><col><col style="width:150px"><col style="width:56px"></colgroup>
          <thead><tr><th>DATA</th><th>DIA</th><th>NOME</th><th>ÂMBITO</th><th></th></tr></thead>
          <tbody>
${HOLS.map(([d, dia, n, nac]) => {
    const mon = dia === 'Segunda-feira';
    return `            <tr${mon ? ' style="background:var(--accwash)"' : ''}>
              <td class="num" style="color:${mon ? 'var(--fg);font-weight:500' : 'var(--fg2)'}">${d}</td>
              <td style="color:${mon ? 'var(--acc2)' : 'var(--fg3)'}">${dia}</td>
              <td style="color:var(--fg)">${n}</td>
              <td><span class="tag ${nac ? 't-mut' : 't-info'}">${nac ? 'NACIONAL' : 'LISBOA'}</span></td>
              <td style="text-align:right"><button class="icb">${ico('dots', 15)}</button></td>
            </tr>`;
  }).join('\n')}
          </tbody>
        </table>
        <div style="border-top:1px solid var(--line2);padding:12px 14px;font-size:12px;color:var(--fg3)">
          Só <span style="color:var(--acc2)">05 de outubro</span> cai a uma segunda-feira em 2026, por isso é a única data que o plano deixa sem elementos.
        </div>
      </div>`
}));
/* ------------------------------------------------------------- Skeleton */
const skrow = (i) => `            <tr>
              <td><div class="skl" style="width:58px;height:11px;animation-delay:${i * 60}ms"></div></td>
              <td><div class="skl" style="width:92px;height:11px;animation-delay:${i * 60 + 30}ms"></div></td>
              <td><div style="display:flex;gap:9px;align-items:center">
                <div class="skl" style="width:18px;height:18px;border-radius:4px;animation-delay:${i * 60 + 60}ms"></div>
                <div class="skl" style="width:44px;height:11px;animation-delay:${i * 60 + 60}ms"></div>
                <div class="skl" style="width:18px;height:18px;border-radius:4px;animation-delay:${i * 60 + 90}ms"></div>
                <div class="skl" style="width:44px;height:11px;animation-delay:${i * 60 + 90}ms"></div>
              </div></td>
              <td><div class="skl" style="width:82px;height:21px;border-radius:5px;animation-delay:${i * 60 + 120}ms"></div></td>
              <td></td>
            </tr>`;

w('Skeleton.dc.html', page({
  active: 'plano',
  top: `      <div style="display:flex;align-items:center;gap:14px">
        <div class="h1">Plano</div>
        <div class="skl" style="width:104px;height:21px;border-radius:5px"></div>
      </div>
      <div style="display:flex;gap:9px">
        <button class="btn" style="opacity:.45">${ico('spark', 14)}GERAR</button>
        <button class="btn pri" style="opacity:.45">${ico('copy', 14)}COPIAR EMAIL</button>
      </div>`,
  body: `      <div class="card" style="flex:1;overflow:hidden;display:flex;flex-direction:column">
        <table style="table-layout:fixed">
          <colgroup><col style="width:110px"><col style="width:180px"><col><col style="width:290px"><col style="width:56px"></colgroup>
          <thead><tr><th>DATA</th><th>DIA</th><th>ELEMENTOS</th><th>ESTADO</th><th></th></tr></thead>
          <tbody>
            <tr><td colspan="5" style="padding:16px 14px 7px;border-top:1px solid var(--line2)"><div class="skl" style="width:118px;height:10px"></div></td></tr>
${[0, 1, 2, 3].map(skrow).join('\n')}
            <tr><td colspan="5" style="padding:16px 14px 7px;border-top:1px solid var(--line2)"><div class="skl" style="width:110px;height:10px"></div></td></tr>
${[4, 5, 6, 7].map(skrow).join('\n')}
          </tbody>
        </table>
        <div style="margin-top:auto;border-top:1px solid var(--line2);padding:12px 14px;display:flex;align-items:center;justify-content:space-between">
          <div class="skl" style="width:186px;height:11px"></div>
          <button class="btn pri" style="opacity:.45">PUBLICAR PLANO</button>
        </div>
      </div>`
}));
console.log('ok');

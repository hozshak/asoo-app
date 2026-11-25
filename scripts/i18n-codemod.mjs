// Macht die sichtbaren deutschen Texte der App übersetzbar: '…' → t('…') (siehe src/lib/i18n.ts).
// Aufruf: node scripts/i18n-codemod.mjs [--write]   (ohne --write nur Probelauf mit Liste)
// Erfasst nur Texte in eindeutig sichtbaren Stellen: Text in JSX, Beschriftungs-Props (title, label, placeholder …),
// Beschriftungs-Felder in Objekten, Meldungs-Aufrufe (Alert.alert, say, setNote …), Anzeige-Tabellen (const X = { k: 'Text' } / [['k', 'Text']]).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const ROOT = path.resolve('src');
const WRITE = process.argv.includes('--write');
const UI_ATTRS = new Set(['title', 'label', 'placeholder', 'accessibilityLabel', 'accessibilityHint', 'text', 'sub', 'subtitle', 'hint', 'message', 'ok', 'cancel', 'confirm', 'emptyText', 'emptyTitle', 'header', 'caption', 'desc', 'description', 'note', 'empty', 'question', 'tip', 'badgeText', 'actionLabel', 'okLabel']);
const UI_PROPS = new Set([...UI_ATTRS, 'dialogTitle', 'labelOff', 'labelOn', 'heading', 'info', 'detail', 'summary', 'short', 'long', 'help', 'warning']);
const UI_CALLS = new Set(['Alert.alert', 'Alert.prompt', 'say', 'setNote', 'setMsg', 'setErr', 'setError', 'onNote', 'note', 'toast', 'showNote', 'setInfo', 'setHint', 'setWarn', 'notify', 'flash']);
const looksUi = (s) => {
  const v = s.trim();
  if (!v || !/\p{L}/u.test(v)) return false;
  if (/^(https?:|\/|#|@|\.\/|\.\.\/)/.test(v)) return false;
  if (/^[a-z0-9_.:\-\/]+$/.test(v)) return false; // Kennungen wie 'online', 'chat/[id]'
  if (/^[A-Z0-9_]{2,}$/.test(v) && v.length > 4) return false; // KONSTANTEN
  if (/^(rgba?|hsla?)\(/.test(v)) return false;
  return true;
};
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'lang') walk(p); } else if (/\.(tsx|ts)$/.test(f) && !/(i18n|icon-paths|theme)\.ts$/.test(f) && !/\.d\.ts$/.test(f)) files.push(p); } };
walk(ROOT);
let total = 0;
const keys = new Set();
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const q = (s) => JSON.stringify(s);
  // Ausdruck in sichtbarem Zusammenhang übersetzen (auch in ?:, ||, ??, &&, Klammern, Vorlagen, '+'-Ketten)
  const uiExpr = (node, inJsxAttr = false) => {
    if (!node) return;
    if (ts.isParenthesizedExpression(node)) return uiExpr(node.expression);
    if (ts.isConditionalExpression(node)) { uiExpr(node.whenTrue); uiExpr(node.whenFalse); return; }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) { uiExpr(node.left); uiExpr(node.right); return; }
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) { uiExpr(node.right); return; }
      if (op === ts.SyntaxKind.PlusToken) {
        // 'Text ' + x + ' mehr' → t('Text {0} mehr', { 0: x })
        const parts = [];
        const flat = (n) => { if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) { flat(n.left); flat(n.right); } else parts.push(n); };
        flat(node);
        if (!parts.some((p) => (ts.isStringLiteral(p) || ts.isNoSubstitutionTemplateLiteral(p)) && looksUi(p.text))) return;
        let text = '', vars = [], i = 0;
        for (const p of parts) {
          if (ts.isStringLiteral(p) || ts.isNoSubstitutionTemplateLiteral(p)) text += p.text;
          else { text += '{' + i + '}'; vars.push(i++ + ': ' + p.getText(sf)); }
        }
        keys.add(text);
        edits.push([node.getStart(sf), node.getEnd(), inJsxAttr ? `{t(${q(text)}, { ${vars.join(', ')} })}` : `t(${q(text)}, { ${vars.join(', ')} })`]);
        return;
      }
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!looksUi(node.text)) return;
      keys.add(node.text);
      edits.push([node.getStart(sf), node.getEnd(), inJsxAttr ? `{t(${q(node.text)})}` : `t(${q(node.text)})`]);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      let text = node.head.text; const vars = [];
      node.templateSpans.forEach((sp, i) => { text += '{' + i + '}' + sp.literal.text; vars.push(i + ': ' + sp.expression.getText(sf)); });
      if (!looksUi(text.replace(/\{\d+\}/g, ''))) return;
      keys.add(text);
      edits.push([node.getStart(sf), node.getEnd(), `t(${q(text)}, { ${vars.join(', ')} })`]);
    }
  };
  const visit = (node) => {
    // schon übersetzt: t('…')
    if (ts.isCallExpression(node) && ['t', 'tr'].includes(node.expression.getText(sf))) return;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxText(node)) {
      const raw = node.getFullText(sf);
      const text = raw.replace(/\s+/g, ' ').trim();
      // sichtbarer Text in JSX ist immer Oberfläche – auch ein kleines Wort wie „passt“
      if (/\p{L}/u.test(text)) {
        const lead = /^[ \t]+/.test(raw) && !/^\s*\n/.test(raw) ? "{' '}" : '';
        const trail = /[ \t]+$/.test(raw) && !/\n\s*$/.test(raw) ? "{' '}" : '';
        keys.add(text);
        edits.push([node.getStart(sf), node.getEnd(), `${lead}{t(${q(text)})}${trail}`]);
      }
      return;
    }
    if (ts.isJsxAttribute(node) && node.initializer && UI_ATTRS.has(node.name.getText(sf))) {
      const init = node.initializer;
      if (ts.isStringLiteral(init)) uiExpr(init, true);
      else if (ts.isJsxExpression(init) && init.expression) uiExpr(init.expression);
      ts.forEachChild(node, visit); // JSX im Prop (z. B. title={<View><T>…</T></View>})
      return;
    }
    // Gruppen wie ['Konto-Einstellungen', [ … ]] – Überschrift + Liste
    if (ts.isArrayLiteralExpression(node) && node.elements.length === 2 && ts.isStringLiteral(node.elements[0]) && ts.isArrayLiteralExpression(node.elements[1]) && looksUi(node.elements[0].text) && /[\s\p{Lu}äöüß]/u.test(node.elements[0].text)) uiExpr(node.elements[0]);
    if (ts.isJsxExpression(node) && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) && node.expression) {
      const e = node.expression;
      if (ts.isConditionalExpression(e) || ts.isStringLiteral(e) || ts.isTemplateExpression(e) || ts.isBinaryExpression(e)) { uiExpr(e); }
    }
    if (ts.isPropertyAssignment(node) && UI_PROPS.has(node.name.getText(sf).replace(/['"]/g, ''))) { uiExpr(node.initializer); return; }
    if (ts.isCallExpression(node) && UI_CALLS.has(node.expression.getText(sf))) { node.arguments.forEach((a) => uiExpr(a)); }
    // Anzeige-Tabellen: const STATUS = [['online', 'Online'], …] / const ACTIVE = { now: 'Jetzt online', … }
    if (ts.isVariableDeclaration(node) && /^[A-Z][A-Z0-9_]*$/.test(node.name.getText(sf)) && node.initializer) {
      const init = node.initializer.kind === ts.SyntaxKind.AsExpression ? node.initializer.expression : node.initializer;
      if (ts.isObjectLiteralExpression(init)) for (const p of init.properties) if (ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.initializer)) && looksUi(p.initializer.text) && /[\s\p{Lu}äöüß]/u.test(p.initializer.text)) uiExpr(p.initializer);
      if (ts.isArrayLiteralExpression(init)) for (const el of init.elements) if (ts.isArrayLiteralExpression(el) && el.elements.length >= 2 && ts.isStringLiteral(el.elements[0])) el.elements.slice(1).forEach((x) => { if (ts.isStringLiteral(x) && /[\s\p{Lu}äöüß]/u.test(x.text)) uiExpr(x); });
      // const DAYS = ['Mo', 'Di', …] – Liste von Anzeigetexten
      if (ts.isArrayLiteralExpression(init) && init.elements.length && init.elements.every((x) => ts.isStringLiteral(x) && looksUi(x.text) && /[\s\p{Lu}äöüß]/u.test(x.text))) init.elements.forEach((x) => uiExpr(x));
      // const KIND = { match: ['und du passt zusammen …', 'pad', …] } – erster Eintrag ist der Anzeigetext
      if (ts.isObjectLiteralExpression(init)) for (const p of init.properties) if (ts.isPropertyAssignment(p) && ts.isArrayLiteralExpression(p.initializer) && p.initializer.elements[0] && ts.isStringLiteral(p.initializer.elements[0]) && /\s/.test(p.initializer.elements[0].text)) uiExpr(p.initializer.elements[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  // überlappende Änderungen vermeiden (äußere gewinnt)
  edits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const keep = []; let end = -1;
  for (const e of edits) { if (e[0] >= end) { keep.push(e); end = e[1]; } }
  let out = src;
  for (const [s, e, r] of keep.reverse()) out = out.slice(0, s) + r + out.slice(e);
  if (!/from '@\/lib\/i18n'|from '\.\/i18n'|from '\.\.\/lib\/i18n'/.test(out)) {
    const imp = file.includes(path.join('src', 'lib')) ? "import { t } from './i18n';\n" : "import { t } from '@/lib/i18n';\n";
    // nach dem letzten import einfügen
    const m = [...out.matchAll(/^import [^\n]*\n/gm)].pop();
    out = m ? out.slice(0, m.index + m[0].length) + imp + out.slice(m.index + m[0].length) : imp + out;
  }
  total += keep.length;
  if (WRITE) fs.writeFileSync(file, out);
  else console.log(path.relative(ROOT, file), keep.length);
}
if (process.argv.includes('--keys')) fs.writeFileSync('i18n-keys.txt', [...keys].join('\n'));
console.log('Stellen:', total, '| verschiedene Texte:', keys.size, WRITE ? '(geschrieben)' : '(Probelauf)');

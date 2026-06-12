const S={
  buf:'',
  display:'0',
  expr:'',
  lastOp:false,
  justEvaled:false,
  parenDepth:0,
  mode:'deg',
  ans:0,
  hasAns:false,
  mem:{A:null,B:null,C:null,D:null,E:null},
  simpleMem:0,
  hasSimpleMem:false,
  history:[],
  pendingNthRoot:false,
  pendingNcr:false,
  pendingNpr:false,
  pendingGcd:false,
  pendingLcm:false,
  pendingLogBase:false,
  pendingAtan2:false,
  pendingArg1:null,
  error:false
};

const $main=document.getElementById('dispMain');
const $expr=document.getElementById('dispExpr');
const $dAns=document.getElementById('dAns');
const $dParen=document.getElementById('dParen');
const $histList=document.getElementById('histList');
const $sidePanel=document.getElementById('sidePanel');
const $panelToggle=document.getElementById('panelToggle');
const $dispWrap=$main.closest('.display-wrap');

function rad(x){
  if(S.mode==='deg') return x*Math.PI/180;
  if(S.mode==='grad') return x*Math.PI/200;
  return x;
}

function unrad(x){
  if(S.mode==='deg') return x*180/Math.PI;
  if(S.mode==='grad') return x*200/Math.PI;
  return x;
}

function fmt(n){
  if(typeof n!=='number'||isNaN(n)) return 'NaN';
  if(!isFinite(n)) return n>0?'∞':'-∞';
  if(Math.abs(n)>=1e15||(Math.abs(n)<1e-10&&n!==0)){
    return n.toExponential(8).replace(/\.?0+e/,'e');
  }
  return parseFloat(n.toPrecision(12)).toString();
}

function setDisp(v){
  S.display=String(v);
  $main.textContent=S.display;
  const l=S.display.length;
  $main.className='display-main'+(l>18?' xs':l>12?' sm':'');
}

function setExpr(v){
  S.expr=v;
  $expr.textContent=v||'\u00a0';
}

function updateMeta(){
  $dAns.textContent=S.hasAns?`ANS=${fmt(S.ans)}`:'';
  $dParen.textContent=S.parenDepth>0?`( ×${S.parenDepth}`:'';
  updateConv();
  updateMemSlots();
}

function updateConv(){
  const n=parseFloat(S.display);
  if(!isNaN(n)&&isFinite(n)&&Number.isInteger(n)&&n>=0&&n<=2**53){
    document.getElementById('convDec').textContent=n.toString(10);
    document.getElementById('convHex').textContent=n.toString(16).toUpperCase();
    document.getElementById('convOct').textContent=n.toString(8);
    document.getElementById('convBin').textContent=n.toString(2);
  } else {
    const raw=S.display;
    document.getElementById('convDec').textContent=raw;
    ['convHex','convOct','convBin'].forEach(id=>document.getElementById(id).textContent='—');
  }
}

function updateMemSlots(){
  ['A','B','C','D','E'].forEach(k=>{
    const el=document.getElementById('slot'+k);
    el.textContent=S.mem[k]!==null?fmt(S.mem[k]):'—';
  });
}

function flash(){
  $dispWrap.classList.remove('eval');
  void $dispWrap.offsetWidth;
  $dispWrap.classList.add('eval');
  setTimeout(()=>$dispWrap.classList.remove('eval'),200);
}

function err(msg){
  S.error=true;
  setDisp(msg||'エラー');
  setExpr('');
}

function reset(){
  S.buf='';S.lastOp=false;S.justEvaled=false;S.parenDepth=0;S.error=false;
  S.pendingNthRoot=S.pendingNcr=S.pendingNpr=S.pendingGcd=S.pendingLcm=false;
  S.pendingLogBase=S.pendingAtan2=false;S.pendingArg1=null;
  setDisp('0');setExpr('');updateMeta();
}

function addHist(expr,result){
  S.history.unshift({expr,result});
  if(S.history.length>60) S.history.pop();
  renderHist();
}

function renderHist(){
  if(!S.history.length){
    $histList.innerHTML='<li class="empty-note">履歴なし</li>';
    return;
  }
  $histList.innerHTML=S.history.map((h,i)=>`
    <li class="hist-item" data-i="${i}">
      <div class="hi-expr">${esc(h.expr)}</div>
      <div class="hi-result">${esc(String(h.result))}</div>
    </li>`).join('');
}

function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function factorial(n){
  if(n<0||!Number.isInteger(n)) return NaN;
  if(n>170) return Infinity;
  let r=1;for(let i=2;i<=n;i++) r*=i;return r;
}

function gcd(a,b){
  a=Math.abs(Math.round(a));b=Math.abs(Math.round(b));
  while(b){let t=b;b=a%b;a=t;}return a;
}

function lcm(a,b){
  const g=gcd(a,b);return g===0?0:Math.abs(a*b)/g;
}

function nCr(n,r){
  n=Math.round(n);r=Math.round(r);
  if(r<0||r>n) return 0;
  if(r===0||r===n) return 1;
  r=Math.min(r,n-r);
  let num=1,den=1;
  for(let i=0;i<r;i++){num*=(n-i);den*=(i+1);}
  return num/den;
}

function nPr(n,r){
  n=Math.round(n);r=Math.round(r);
  if(r<0||r>n) return 0;
  let res=1;
  for(let i=0;i<r;i++) res*=(n-i);
  return res;
}

function humanBuf(b){
  return b.replace(/\*\*/g,'^').replace(/\*/g,'×').replace(/\//g,'÷');
}

function appendDigit(d){
  if(S.error) reset();
  if(S.justEvaled){S.buf='';S.justEvaled=false;}
  if(d==='.'&&S.display.includes('.')&&!S.lastOp) return;
  if(S.lastOp||( S.display==='0'&&d!=='.')){
    S.lastOp=false;
    setDisp(d==='.'?'0.':d);
    S.buf+=d==='.'?'0.':d;
  } else {
    setDisp(S.display+d);
    S.buf+=d;
  }
  tryPreview();
  updateMeta();
}

function appendOp(op){
  if(S.error) return;
  S.justEvaled=false;
  if(!S.buf) S.buf=S.display;
  if(S.lastOp){
    const ops=['**','*','/','+','-','%'];
    for(const o of ops){if(S.buf.endsWith(o)){S.buf=S.buf.slice(0,-o.length);break;}}
  }
  S.buf+=op;S.lastOp=true;
  setExpr(humanBuf(S.buf));
  updateMeta();
}

function tryPreview(){
  if(S.buf.length<2) return;
  try{
    const r=safeEval(S.buf);
    if(isFinite(r)&&!isNaN(r)) setExpr(humanBuf(S.buf));
  } catch(_){}
}

function safeEval(expr){
  const js=expr
    .replace(/π/g,String(Math.PI))
    .replace(/\bφ\b/g,String((1+Math.sqrt(5))/2))
    .replace(/([0-9\.]+)[eE]([+\-]?[0-9]+)/g,'($1e$2)')
    ;
  return Function('"use strict";return ('+js+')')();
}

function applyUnary(fn){
  if(S.error) return;
  const x=parseFloat(S.display);
  if(isNaN(x)) return;
  let r,label;
  switch(fn){
    case 'sin':   r=Math.sin(rad(x));   label=`sin(${x})`; break;
    case 'cos':   r=Math.cos(rad(x));   label=`cos(${x})`; break;
    case 'tan':   r=Math.tan(rad(x));   label=`tan(${x})`; break;
    case 'asin':  r=unrad(Math.asin(x));label=`sin⁻¹(${x})`; break;
    case 'acos':  r=unrad(Math.acos(x));label=`cos⁻¹(${x})`; break;
    case 'atan':  r=unrad(Math.atan(x));label=`tan⁻¹(${x})`; break;
    case 'sinh':  r=Math.sinh(x);       label=`sinh(${x})`; break;
    case 'cosh':  r=Math.cosh(x);       label=`cosh(${x})`; break;
    case 'tanh':  r=Math.tanh(x);       label=`tanh(${x})`; break;
    case 'asinh': r=Math.asinh(x);      label=`sinh⁻¹(${x})`; break;
    case 'acosh': r=Math.acosh(x);      label=`cosh⁻¹(${x})`; break;
    case 'atanh': r=Math.atanh(x);      label=`tanh⁻¹(${x})`; break;
    case 'log':   r=Math.log10(x);      label=`log₁₀(${x})`; break;
    case 'ln':    r=Math.log(x);        label=`ln(${x})`; break;
    case 'log2':  r=Math.log2(x);       label=`log₂(${x})`; break;
    case 'pow10': r=Math.pow(10,x);     label=`10^(${x})`; break;
    case 'exp':   r=Math.exp(x);        label=`e^(${x})`; break;
    case 'pow2':  r=Math.pow(2,x);      label=`2^(${x})`; break;
    case 'sqrt':  r=Math.sqrt(x);       label=`√(${x})`; break;
    case 'cbrt':  r=Math.cbrt(x);       label=`∛(${x})`; break;
    case 'sq':    r=x*x;               label=`(${x})²`; break;
    case 'cube':  r=x*x*x;            label=`(${x})³`; break;
    case 'inv':   r=1/x;              label=`1/(${x})`; break;
    case 'abs':   r=Math.abs(x);      label=`|${x}|`; break;
    case 'pct':   r=x/100;           label=`${x}%`; break;
    case 'fact':  r=factorial(x);    label=`${x}!`; break;
    case 'floor': r=Math.floor(x);   label=`⌊${x}⌋`; break;
    case 'ceil':  r=Math.ceil(x);    label=`⌈${x}⌉`; break;
    case 'round': r=Math.round(x);   label=`round(${x})`; break;
    default: return;
  }
  if(isNaN(r)){err('定義域エラー');return;}
  if(!isFinite(r)){err(r>0?'∞':'-∞');return;}
  finishUnary(r,label);
}

function finishUnary(r,label){
  const f=fmt(r);
  setExpr(label+' =');
  setDisp(f);
  S.buf=f;S.lastOp=false;S.justEvaled=true;
  S.ans=r;S.hasAns=true;
  addHist(label,f);
  flash();
  updateMeta();
}

function handleBinary(action){
  const x=parseFloat(S.display);
  if(S.pendingArg1===null){
    S.pendingArg1=x;
    switch(action){
      case 'nthroot':  S.pendingNthRoot=true;  break;
      case 'ncr':      S.pendingNcr=true;      break;
      case 'npr':      S.pendingNpr=true;      break;
      case 'gcd':      S.pendingGcd=true;      break;
      case 'lcm':      S.pendingLcm=true;      break;
      case 'logbase':  S.pendingLogBase=true;  break;
      case 'atan2':    S.pendingAtan2=true;    break;
    }
    const labels={nthroot:`ʸ√ (y=${x})`,ncr:`${x} C`,npr:`${x} P`,gcd:`GCD(${x},`,lcm:`LCM(${x},`,logbase:`log_${x}(`,atan2:`atan2(${x},`};
    setExpr(labels[action]+' ?');
    S.buf='';S.lastOp=true;S.justEvaled=false;
  }
}

function tryResolveBinary(){
  const x=parseFloat(S.display);
  const a=S.pendingArg1;
  let r,label;
  if(S.pendingNthRoot){r=Math.pow(x,1/a);label=`${a}√(${x})`;}
  else if(S.pendingNcr){r=nCr(a,x);label=`${a}C${x}`;}
  else if(S.pendingNpr){r=nPr(a,x);label=`${a}P${x}`;}
  else if(S.pendingGcd){r=gcd(a,x);label=`GCD(${a},${x})`;}
  else if(S.pendingLcm){r=lcm(a,x);label=`LCM(${a},${x})`;}
  else if(S.pendingLogBase){r=Math.log(x)/Math.log(a);label=`log_${a}(${x})`;}
  else if(S.pendingAtan2){r=unrad(Math.atan2(a,x));label=`atan2(${a},${x})`;}
  else return false;
  S.pendingNthRoot=S.pendingNcr=S.pendingNpr=S.pendingGcd=S.pendingLcm=false;
  S.pendingLogBase=S.pendingAtan2=false;
  S.pendingArg1=null;
  if(isNaN(r)){err('エラー');return true;}
  finishUnary(r,label);
  return true;
}

function handleParen(){
  if(S.error) return;
  if(S.parenDepth===0||S.lastOp){
    S.buf+='(';S.parenDepth++;S.lastOp=true;
  } else {
    S.buf+=')';S.parenDepth=Math.max(0,S.parenDepth-1);S.lastOp=false;
  }
  setExpr(humanBuf(S.buf));
  updateMeta();
}

function evaluate(){
  if(S.error){reset();return;}
  if(tryResolveBinary()) return;
  if(!S.buf) return;
  let ex=S.buf+')'.repeat(S.parenDepth);
  try{
    const r=safeEval(ex);
    if(!isFinite(r)){err(r>0?'∞':r<0?'-∞':'NaN');return;}
    const f=fmt(r);
    addHist(humanBuf(ex)+' =',f);
    setExpr(humanBuf(ex)+' =');
    setDisp(f);
    S.buf=f;S.lastOp=false;S.parenDepth=0;S.justEvaled=true;
    S.ans=r;S.hasAns=true;
    flash();
  } catch(_){
    err('構文エラー');
  }
  updateMeta();
}

function delChar(){
  if(S.error){reset();return;}
  if(S.justEvaled){reset();return;}
  if(!S.buf) return;
  if(S.buf.endsWith('**')) S.buf=S.buf.slice(0,-2);
  else{
    const l=S.buf.slice(-1);
    if(l==='(') S.parenDepth=Math.max(0,S.parenDepth-1);
    if(l===')') S.parenDepth++;
    S.buf=S.buf.slice(0,-1);
  }
  S.lastOp=/[\+\-\*\/\(\^]$/.test(S.buf);
  if(!S.buf){setDisp('0');}
  else{const m=S.buf.match(/[\d\.eE\+\-]+$/);setDisp(m?m[0]:'0');}
  setExpr(humanBuf(S.buf));
  updateMeta();
}

function doMem(action,slot){
  const x=parseFloat(S.display)||0;
  switch(action){
    case 'mc':   S.simpleMem=0;S.hasSimpleMem=false; break;
    case 'mr':
      if(S.hasSimpleMem){const f=fmt(S.simpleMem);setDisp(f);S.buf=f;S.lastOp=false;}
      break;
    case 'mplus':  S.simpleMem+=x;S.hasSimpleMem=true; break;
    case 'mminus': S.simpleMem-=x;S.hasSimpleMem=true; break;
    case 'mstore': S.mem[slot]=x; break;
    case 'mrecall':
      if(S.mem[slot]!==null){const f=fmt(S.mem[slot]);setDisp(f);S.buf=f;S.lastOp=false;}
      break;
  }
  updateMeta();
}

document.querySelectorAll('.b').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const d=btn.dataset.d;
    const a=btn.dataset.a;
    if(d!==undefined){appendDigit(d);return;}
    const binaryFns=['nthroot','ncr','npr','gcd','lcm','logbase','atan2'];
    if(binaryFns.includes(a)){handleBinary(a);return;}
    switch(a){
      case 'ac':    reset(); break;
      case 'del':   delChar(); break;
      case 'eq':    evaluate(); break;
      case 'add':   appendOp('+'); break;
      case 'sub':   appendOp('-'); break;
      case 'mul':   appendOp('*'); break;
      case 'div':   appendOp('/'); break;
      case 'pow':   appendOp('**'); break;
      case 'mod':   appendOp('%'); break;
      case 'paren': handleParen(); break;
      case 'ee':
        if(S.display!=='0'&&!S.display.includes('e')){
          setDisp(S.display+'e+0');S.buf+=S.display.slice(-S.display.length)+'e+0';
        }
        break;
      case 'neg':
      case 'neg2':{
        const cv=parseFloat(S.display);
        if(!isNaN(cv)){
          const nv=fmt(-cv);
          const m=S.buf.match(/([\+\-\*\/\(]|^)([\d\.eE\+\-]+)$/);
          if(m) S.buf=S.buf.slice(0,m.index+m[1].length)+nv;
          else S.buf=nv;
          setDisp(nv);
        }
        break;
      }
      case 'pi':{
        if(S.justEvaled){S.buf='';S.justEvaled=false;}
        const pv=fmt(Math.PI);S.buf+=pv;setDisp(pv);S.lastOp=false;
        break;
      }
      case 'e_c':{
        if(S.justEvaled){S.buf='';S.justEvaled=false;}
        const ev=fmt(Math.E);S.buf+=ev;setDisp(ev);S.lastOp=false;
        break;
      }
      case 'phi':{
        if(S.justEvaled){S.buf='';S.justEvaled=false;}
        const pv2=fmt((1+Math.sqrt(5))/2);S.buf+=pv2;setDisp(pv2);S.lastOp=false;
        break;
      }
      case 'rand':{
        const rv=Math.random();const rf=fmt(rv);
        setDisp(rf);S.buf=rf;S.lastOp=false;
        setExpr('RND =');addHist('RND',rf);flash();
        break;
      }
      case 'ans':
        if(S.hasAns){
          const af=fmt(S.ans);
          if(S.justEvaled){S.buf='';S.justEvaled=false;}
          S.buf+=af;setDisp(af);S.lastOp=false;
        }
        break;
      case 'mc':case 'mr':case 'mplus':case 'mminus':
        doMem(a,null); break;
      default:
        applyUnary(a);
    }
    updateMeta();
  });
});

document.querySelectorAll('.s-btn').forEach(btn=>{
  btn.addEventListener('click',e=>{
    e.stopPropagation();
    doMem(btn.dataset.op,btn.dataset.slot);
  });
});

document.querySelectorAll('.mode-pill').forEach(pill=>{
  pill.addEventListener('click',()=>{
    S.mode=pill.dataset.mode;
    document.querySelectorAll('.mode-pill').forEach(p=>p.classList.toggle('active',p===pill));
  });
});

document.querySelectorAll('.ptab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.ptab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-'+tab.dataset.tab).classList.add('active');
  });
});

$panelToggle.addEventListener('click',()=>{
  $sidePanel.classList.toggle('closed');
  $panelToggle.classList.toggle('on',!$sidePanel.classList.contains('closed'));
});

document.getElementById('clearHistory').addEventListener('click',()=>{
  S.history=[];renderHist();
});

document.getElementById('clearAllMem').addEventListener('click',()=>{
  ['A','B','C','D','E'].forEach(k=>S.mem[k]=null);
  updateMemSlots();
});

$histList.addEventListener('click',e=>{
  const item=e.target.closest('.hist-item');
  if(!item) return;
  const h=S.history[parseInt(item.dataset.i,10)];
  if(!h) return;
  const f=String(h.result);
  setDisp(f);S.buf=f;S.lastOp=false;S.justEvaled=false;
  updateMeta();
});

document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT') return;
  const k=e.key;
  if(k>='0'&&k<='9'){appendDigit(k);return;}
  if(k==='.'){appendDigit('.');return;}
  if(k==='+'){appendOp('+');return;}
  if(k==='-'){appendOp('-');return;}
  if(k==='*'){appendOp('*');return;}
  if(k==='/'){e.preventDefault();appendOp('/');return;}
  if(k==='^'){appendOp('**');return;}
  if(k==='%'){appendOp('%');return;}
  if(k==='('){S.buf+='(';S.parenDepth++;S.lastOp=true;setExpr(humanBuf(S.buf));updateMeta();return;}
  if(k===')'){S.buf+=')';S.parenDepth=Math.max(0,S.parenDepth-1);S.lastOp=false;setExpr(humanBuf(S.buf));updateMeta();return;}
  if(k==='Enter'||k==='='){evaluate();return;}
  if(k==='Backspace'){delChar();return;}
  if(k==='Escape'){reset();return;}
});

renderHist();
$sidePanel.classList.add('closed');
updateMeta();

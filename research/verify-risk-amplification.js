// Run: node verify-risk-amplification.js > risk-amplification-output.json
// No dependencies. All probability numerators and comparisons use BigInt.
const A=[0,1,5,7,8,10,12],B=[0,1,2,5,7,9,12];
function check(ok,msg){if(!ok)throw Error(msg);}
function pop(n){let k=0;while(n){k+=n&1;n>>=1;}return k;}
function distribution(S,num,den){const weights=Array(32).fill(0n);for(let f=0;f<2**S.length;f++){const remaining=new Set(S.filter((_,i)=>!(f&(1<<i))));let lost=0;for(let d=1;d<=5;d++){let found=false;for(const x of remaining)if(remaining.has(x+d)){found=true;break;}if(!found)lost|=1<<(d-1);}const k=pop(f);weights[lost]+=num**BigInt(k)*(den-num)**BigInt(S.length-k);}return {weights,den:den**BigInt(S.length)};}
function zeta(w){return Array.from({length:32},(_,t)=>w.reduce((sum,v,l)=>sum+((l&t)===t?v:0n),0n));}
function IE(w,q){const h=zeta(w);let n=0n;for(let t=1;t<32;t++)n+=(pop(t)%2?1n:-1n)*h[t]**BigInt(q);return n;}
// Independent block combination: globally lost lags are intersection of
// the lost-lag masks of all blocks. No independence between lag events assumed.
function combine(left,right){const out=Array(32).fill(0n);for(let i=0;i<32;i++)for(let j=0;j<32;j++)out[i&j]+=left[i]*right[j];return out;}
function scientificRatio(n,d){if(n===0n)return 0;const ns=n.toString(),ds=d.toString(),take=15;return Number(ns.slice(0,take))/Number(ds.slice(0,take))*10**((ns.length-Math.min(take,ns.length))-(ds.length-Math.min(take,ds.length)));}
const output=[];
for(const [pn,pd] of [[1n,100n],[1n,2n],[9n,10n]]){
 const da=distribution(A,pn,pd),db=distribution(B,pn,pd),ha=zeta(da.weights),hb=zeta(db.weights);
 const u=2n*pn*pd-pn*pn, v=pn*pd*pd+pn*pn*pd-pn**3n;
 // u/pd^2 and v/pd^3. Compare exact numerators on denominator pd^7.
 const aa=u*u*pd**3n,bb=u*v*pd**2n,vv=v*pd**4n;
 check([1,2,4,8,16].every((t,i)=>ha[t]===[aa,bb,aa,aa,bb][i]),'A single-lag polynomials');
 check([1,2,4,8,16].every((t,i)=>hb[t]===[vv,bb,aa,vv,bb][i]),'B single-lag polynomials');
 check(bb<aa&&aa<vv&&vv<da.den,'strict ordering');
 let wa=Array(32).fill(0n);wa[31]=1n;let wb=wa.slice();const rows=[];
 for(let q=1;q<=10;q++){
  wa=combine(wa,da.weights);wb=combine(wb,db.weights);
  const na=wa.slice(1).reduce((s,x)=>s+x,0n),nb=wb.slice(1).reduce((s,x)=>s+x,0n),den=da.den**BigInt(q);
  check(na===IE(da.weights,q)&&nb===IE(db.weights,q),'IE vs independent mask convolution');
  check(wa.reduce((s,x)=>s+x,0n)===den&&wb.reduce((s,x)=>s+x,0n)===den,'probability normalization');
  check(aa**BigInt(q)<=na&&na<=5n*aa**BigInt(q),'A union bounds');
  check(vv**BigInt(q)<=nb&&nb<=5n*vv**BigInt(q),'B union bounds');
  if(q===2){for(const [S,want] of [[A,na],[B,nb]]){const direct=distribution([...S,...S.map(x=>x+18)],pn,pd);check(direct.weights.slice(1).reduce((s,x)=>s+x,0n)===want,'direct 16384 geometry masks');}}
  rows.push({q,sensors:7*q,numeratorA:String(na),numeratorB:String(nb),denominator:String(den),riskA:scientificRatio(na,den),riskB:scientificRatio(nb,den),riskRatio:scientificRatio(nb,na)});
 }
 output.push({p:scientificRatio(pn,pd),exponentialBase:scientificRatio(vv,aa),rows});
}
console.log(JSON.stringify({passed:true,method:'Exact BigInt deletion enumeration + 32-state intersection convolution + inclusion-exclusion; direct 14-sensor enumeration at q=2 for all three p values.',baseMasksPerArray:128,directMasksPer14SensorArray:16384,results:output},null,2));

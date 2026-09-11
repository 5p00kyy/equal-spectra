// Standalone, dependency-free verification: node verify-homometric.js
// Exact integer geometry; unit-weight sensors; protected lags 1..5.
const A=[0,1,5,7,8,10,12], B=[0,1,2,5,7,9,12], L=[1,2,3,4,5];
function assert(ok,label){if(!ok)throw new Error(label);}
function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function histogram(S){const h=Array(S.at(-1)-S[0]+1).fill(0);h[0]=S.length;for(let i=0;i<S.length;i++)for(let j=i+1;j<S.length;j++)h[S[j]-S[i]]++;return h;}
function brute(S){const counts=Array(S.length+1).fill(0),cuts=L.map(()=>S.length),singleFailures=[];
 for(let mask=0;mask<2**S.length;mask++){const remaining=S.filter((_,i)=>!(mask&(1<<i))),r=S.length-remaining.length;const missing=L.filter(d=>!remaining.some(x=>remaining.includes(x+d)));if(missing.length){counts[r]++;if(r===1)singleFailures.push({position:S.find((_,i)=>mask&(1<<i)),missing});}L.forEach((d,i)=>{if(missing.includes(d))cuts[i]=Math.min(cuts[i],r);});}return {counts,cuts,singleFailures};}
function pathCut(S,d){const s=new Set(S);let cut=0;for(const x of S)if(!s.has(x-d)){let len=0;while(s.has(x+len*d))len++;cut+=Math.floor(len/2);}return cut;}
function blocks(S,q){return Array.from({length:q},(_,j)=>S.map(x=>x+18*j)).flat();}
const a=brute(A),b=brute(B);
assert(equal(histogram(A),histogram(B)),'full homometry');
assert(!equal(A.map(x=>12-x).reverse(),B),'nontrivial pair');
assert(equal(a.counts,[0,0,12,33,35,21,7,1]),'A counts');
assert(equal(b.counts,[0,2,16,33,35,21,7,1]),'B counts');
assert(equal(a.cuts,[2,2,2,2,2]),'A cuts');
assert(equal(b.cuts,[1,2,2,1,2]),'B cuts');
for(const [S,result] of [[A,a],[B,b]])assert(equal(L.map(d=>pathCut(S,d)),result.cuts),'path vs brute');
const families=[];
for(let q=1;q<=10;q++){const aq=blocks(A,q),bq=blocks(B,q);assert(equal(histogram(aq),histogram(bq)),'family homometry');const ca=L.map(d=>pathCut(aq,d)),cb=L.map(d=>pathCut(bq,d));assert(equal(ca,[2*q,2*q,2*q,2*q,2*q]),'family A');assert(equal(cb,[q,2*q,2*q,q,2*q]),'family B');families.push({q,cutsA:ca,cutsB:cb});}
// At p=1/100, each r-deletion subset has probability 99^(7-r)/100^7.
// BigInt arithmetic supplies exact probability numerators, with no rounding.
function numerator(counts){return counts.reduce((sum,c,r)=>sum+BigInt(c)*99n**BigInt(7-r),0n);}
const nA=numerator(a.counts),nB=numerator(b.counts),den=100n**7n;
assert(nA===117322939801n && nB===2038322840599n,'exact iid risks');
// Difference coefficients in the degree-seven Bernstein basis certify
// P_B-P_A = 2p(1-p)^6+4p^2(1-p)^5 = 2p(1+p)(1-p)^5.
assert(equal(b.counts.map((c,r)=>c-a.counts[r]),[0,2,4,0,0,0,0,0]),'positive risk difference');
console.log(JSON.stringify({passed:true,A,B,L,positiveHistogram:histogram(A).slice(1),enumeratedMasks:256,Achecks:a,Bchecks:b,families,iidRiskAtPoint01:{numeratorA:String(nA),numeratorB:String(nB),denominator:String(den),A:Number(nA)/Number(den),B:Number(nB)/Number(den),ratio:Number(nB)/Number(nA)},scope:'Finite checks verify examples, not novelty or an infinite theorem. See the accompanying proof.'},null,2));

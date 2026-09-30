import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const S=48000,D=30,N=S*D,L=new Float64Array(N),R=new Float64Array(N),TAU=Math.PI*2;
let seed=91277;
function noise(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/2147483648-1;}
function put(t,d,fn,pan=0){const a=Math.round(t*S),n=Math.round(d*S),lg=Math.sqrt((1-pan)/2),rg=Math.sqrt((1+pan)/2);for(let j=0;j<n&&a+j<N;j++){if(a+j<0)continue;const v=fn(j/S,j);L[a+j]+=v*lg;R[a+j]+=v*rg;}}
function note(m){return 440*2**((m-69)/12);}
function kick(t,amp){let phase=0;put(t,.38,(x)=>{phase+=TAU*(45+115*Math.exp(-x*44))/S;return amp*(Math.sin(phase)*Math.exp(-x*12)+noise()*.2*Math.exp(-x*130));});}
function hat(t,amp,open=false,pan=0){let prev=0;put(t,open?.22:.08,(x)=>{const n=noise(),hi=n-prev;prev=n;return hi*amp*Math.exp(-x*(open?24:75))*(1-Math.exp(-x*1700));},pan);}
function clap(t,amp){let lp=0;put(t,.22,(x)=>{const n=noise();lp=.65*lp+.35*n;const pulse=(Math.exp(-x*60)+.7*Math.exp(-Math.abs(x-.013)*160)+.45*Math.exp(-Math.abs(x-.029)*150));return (n-lp)*amp*pulse;},.08);}
function pluck(t,m,amp,pan=0,d=1.35){const f=note(m);for(let echo=0;echo<4;echo++){put(t+echo*.375,d,x=>{const env=(1-Math.exp(-x*450))*Math.exp(-x*5);return (Math.sin(TAU*f*x)+.28*Math.sin(TAU*f*2*x)*Math.exp(-x*3)+.12*Math.sin(TAU*f*3*x))*amp*env*.5**echo;},echo%2?-pan:pan);}}
function bass(t,m,d,amp){const f=note(m);put(t,d,x=>{const fade=Math.min(1,x/.012,(d-x)/.07);return (Math.sin(TAU*f*x)+.2*Math.sin(TAU*f*2*x))*amp*Math.max(0,fade);});}
const harmony=[[50,57,60,64,69],[46,53,57,60,65],[53,60,64,67,72],[45,52,55,60,64]];
for(let bar=0;bar<15;bar++){
 const t=bar*2,ch=harmony[bar%4];
 const gain=t<6?.65:t<11?.85:t<23?1:.75;
 for(const m of ch){const f=note(m+12);put(t,2.75,x=>{const a=Math.min(1,x/.22)*Math.min(1,(2.75-x)/.65);const beatPhase=((t+x)% .5)/.5;const duck=.6+.4*(1-Math.exp(-beatPhase*8));return (Math.sin(TAU*f*x)+.3*Math.sin(TAU*(f*1.002)*x))*a*.015*gain*duck;},(m%5-2)*.3);}
 if(t<28){for(let b=0;b<4;b++){const bt=t+b*.5;kick(bt,.44*gain);if(b%2)clap(bt,.15*gain);if(t>=3){hat(bt+.25,.055*gain,false,b%2?.4:-.4);if(t>=11)hat(bt+.375,.026*gain,false,-.5);}if(t>=6&&b===3)hat(bt+.25,.036*gain,true,.45);}
 bass(t,ch[0]-12,.33,.15*gain);bass(t+.75,ch[0]-12,.2,.12*gain);bass(t+1.5,ch[0]-12,.35,.14*gain);}
 const seq=[ch[2]+12,ch[4]+12,ch[3]+12,ch[1]+24];
 for(let q=0;q<4;q++)pluck(t+q*.5,seq[q],.065*gain,q%2?.5:-.5);
 if(t>=17&&t<23)for(let q=0;q<8;q++)pluck(t+q*.25,ch[(q+2)%5]+24,.027,q%2?.7:-.7,.9);
}
// Discrete foley accents on scene changes and a restrained rising air layer.
for(const t of [3,6,11,17,23]){
 put(t-.24,.44,x=>{const env=Math.sin(Math.PI*x/.44)**2;return noise()*.028*env;},-.25);
 put(t,.6,x=>Math.sin(TAU*(190*Math.exp(-x*5)+42)*x)*Math.exp(-x*10)*.05);
}
for(const m of [62,69,74])pluck(28.25,m,.075,(m%3-1)*.5,1.7);
// Short stereo room taps, soft saturation, and a clean 30-second ending.
const dryL=L.slice(),dryR=R.slice();
for(const [delay,gain] of [[.091,.10],[.173,.07],[.283,.045]]){const offset=Math.round(delay*S);for(let i=offset;i<N;i++){L[i]+=dryR[i-offset]*gain;R[i]+=dryL[i-offset]*gain;}}
let peak=0;for(let i=0;i<N;i++){L[i]=Math.tanh(L[i]*1.15);R[i]=Math.tanh(R[i]*1.15);peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));}
const wav=Buffer.alloc(44+N*4);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(S,24);wav.writeUInt32LE(S*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(N*4,40);
for(let i=0;i<N;i++){const t=i/S,fade=Math.min(1,t/.025,(D-t)/.6),g=.82/peak*Math.max(0,fade);wav.writeInt16LE(Math.round(L[i]*g*32767),44+i*4);wav.writeInt16LE(Math.round(R[i]*g*32767),46+i*4);}
fs.writeFileSync(new URL('../assets/score.wav',import.meta.url),wav);console.log('Original stereo score: 30s, 48kHz, peak -1.72dBFS');

const raw=new URL('../assets/score.wav',import.meta.url),master=new URL('../assets/score-master.wav',import.meta.url);
const mastering=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',fileURLToPath(raw),'-af','loudnorm=I=-16:TP=-1:LRA=7','-ar','48000',fileURLToPath(master)],{stdio:'inherit'});
if(mastering.status!==0)process.exit(mastering.status||1);
fs.copyFileSync(master,new URL('../portrait/assets/score-master.wav',import.meta.url));

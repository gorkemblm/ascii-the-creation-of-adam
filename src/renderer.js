import { WIDTH, HEIGHT, HAND_ANCHORS } from './hands.js';

export const DENSITIES = Object.freeze({ medium: 360, high: 520 });

const ramps = { robot: ' .,:;i1tfLCG08%#@', human: ' .,:;irsXA253hMHGS#9B&@' };
const sampleOffsets = [[0, 0], [-.28, -.28], [.28, -.28], [-.28, .28], [.28, .28]];
const gapCenter = {
  x: (HAND_ANCHORS.robot.x + HAND_ANCHORS.human.x) / 2,
  y: (HAND_ANCHORS.robot.y + HAND_ANCHORS.human.y) / 2,
};
const maxReach = Math.max(0, (HAND_ANCHORS.human.x - HAND_ANCHORS.robot.x - 8) / 2);

export class AsciiRenderer {
  constructor(canvas, layers, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.robot = layers.robot;
    this.human = layers.human;
    this.sample = document.createElement('canvas');
    this.sample.width = WIDTH;
    this.sample.height = HEIGHT;
    this.source = this.sample.getContext('2d', { willReadFrequently: true });
    this.state = {
      time: 0, density: options.density, paused: options.paused,
      pointer: { x: -1000, y: -1000, active: false },
      pulse: -100, w: 0, h: 0, dpr: 1, cols: 360, rows: 93,
      frame: [], worldHeight: HEIGHT,
    };
    this.abort = new AbortController();
    const { signal } = this.abort;
    this.motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    this.inView = true;
    this.raf = 0;
    this.lastTime = 0;
    this.lastDraw = 0;
    this.destroyed = false;

    canvas.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      const bounds = canvas.getBoundingClientRect();
      const worldHeight = this.state.worldHeight;
      this.state.pointer = {
        x: (event.clientX - bounds.left) / bounds.width * WIDTH,
        y: (event.clientY - bounds.top) / bounds.height * worldHeight - (worldHeight - HEIGHT) / 2,
        active: true,
      };
      if (!this.canAnimate()) this.draw();
    }, { signal });
    canvas.addEventListener('pointerleave', () => {
      this.state.pointer.active = false;
      if (!this.canAnimate()) this.draw();
    }, { signal });
    document.addEventListener('visibilitychange', () => this.sync(), { signal });
    window.addEventListener('resize', () => this.resize(), { signal });
    this.motionPreference.addEventListener('change', () => this.sync(), { signal });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver(entries => {
      this.inView = entries[0].isIntersecting;
      this.sync();
    });
    this.intersectionObserver.observe(canvas);
    this.resize();
  }

  resize() {
    if (this.destroyed) return;
    const bounds = this.canvas.getBoundingClientRect();
    const state = this.state;
    state.w = bounds.width;
    state.h = bounds.height;
    state.dpr = Math.min(devicePixelRatio || 1, 2);
    state.worldHeight = state.w ? state.h / state.w * WIDTH : HEIGHT;
    state.cols = Math.round(DENSITIES[state.density] * (state.w < 700 ? .55 : 1));
    state.rows = Math.max(1, Math.round(state.cols * state.worldHeight / WIDTH / 1.65));
    this.canvas.width = Math.round(state.w * state.dpr);
    this.canvas.height = Math.round(state.h * state.dpr);
    this.sync();
  }

  canAnimate() {
    return !this.destroyed && !this.state.paused && !this.motionPreference.matches
      && !document.hidden && this.inView && this.state.w > 0 && this.state.h > 0;
  }

  sync() {
    if (this.destroyed) return;
    this.draw();
    if (this.canAnimate()) {
      if (!this.raf) this.raf = requestAnimationFrame(this.tick);
    } else {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.lastTime = 0;
    }
  }

  tick = now => {
    this.raf = 0;
    if (!this.canAnimate()) return;
    if (this.lastTime) this.state.time += Math.min((now - this.lastTime) / 1000, .1);
    this.lastTime = now;
    if (now - this.lastDraw >= 1000 / 30) {
      this.draw();
      this.lastDraw = now;
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  draw() { if (!this.destroyed) draw(this); }

  setDensity(density) {
    this.state.density = density;
    this.resize();
  }

  setPaused(paused) {
    this.state.paused = paused;
    this.sync();
  }

  spark() {
    clearTimeout(this.pulseTimeout);
    this.state.pulse = this.state.time;
    this.draw();
    if (!this.canAnimate()) {
      this.pulseTimeout = setTimeout(() => {
        this.state.pulse = -100;
        this.draw();
      }, 250);
    }
  }

  toText() { return this.state.frame.join('\n'); }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.pulseTimeout);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.abort.abort();
  }
}

function movement(state) {
  const cycle = (state.time % 10) / 10;
  const approach = (1 - Math.cos(cycle * Math.PI * 2)) / 2;
  const near = state.pointer.active
    ? Math.max(0, 1 - Math.hypot(state.pointer.x - gapCenter.x, state.pointer.y - gapCenter.y) / 230)
    : 0;
  return {
    approach, near,
    reach: maxReach * (approach * .65 + near * .35),
    robotY: Math.sin(state.time * .65) * 1.2,
    humanY: Math.sin(state.time * .65 + 1.3),
  };
}

function compose(renderer) {
  const { state, source, robot, human } = renderer;
  const { reach, robotY, humanY } = movement(state);
  source.clearRect(0, 0, WIDTH, HEIGHT);
  source.save();
  source.translate(reach, robotY);
  source.drawImage(robot, 0, 0);
  source.restore();
  source.save();
  source.translate(-reach, humanY);
  source.drawImage(human, 0, 0);
  source.restore();
  return source.getImageData(0, 0, WIDTH, HEIGHT).data;
}

function draw(renderer) {
  const { state, ctx } = renderer;
  if(!state.w)return;
  const data=compose(renderer),{reach,approach,near,robotY,humanY}=movement(state);
  const worldH=state.worldHeight;
  const yOffset=(worldH-HEIGHT)/2;
  const cw=WIDTH/state.cols,ch=worldH/state.rows;
  const sx=state.w/WIDTH,sy=state.h/worldH;
  ctx.setTransform(state.dpr*sx,0,0,state.dpr*sy,0,0);
  ctx.fillStyle='#0b0c0c';ctx.fillRect(0,0,WIDTH,worldH);
  // The only marks in the artwork are printable ASCII glyphs.
  ctx.font=`500 ${cw*1.62}px "SFMono-Regular",Consolas,"Liberation Mono",monospace`;
  ctx.textBaseline='middle';ctx.textAlign='center';
  const frame=Array.from({length:state.rows},()=>Array(state.cols).fill(' '));
  const pulseAge=state.time-state.pulse;
  const pulseRadius=pulseAge*240;
  const automatic=Math.pow(approach,18)*.75;
  const energy=Math.max(automatic,near*.65,pulseAge>=0&&pulseAge<1.8?Math.exp(-pulseAge*2):0);
  for(let row=0;row<state.rows;row++){
    const wy=(row+.5)*ch-yOffset;
    if(wy<0||wy>=HEIGHT)continue;
    for(let col=0;col<state.cols;col++){
      const wx=(col+.5)*cw;
      // Average five positions per cell to preserve tendons, plate edges and
      // fingernails without aliasing when the density changes.
      let coverage=0,luminance=0;
      for(const [dx,dy] of sampleOffsets){
        const px=Math.max(0,Math.min(WIDTH-1,Math.floor(wx+dx*cw)));
        const py=Math.max(0,Math.min(HEIGHT-1,Math.floor(wy+dy*ch)));
        const offset=(py*WIDTH+px)*4;
        const a=data[offset+3]/255;
        coverage+=a;luminance+=data[offset]*a;
      }
      const alpha=coverage/5;
      if(alpha<.22)continue;
      let tone=Math.pow(luminance/coverage/255,.78);
      const isRobot=wx<gapCenter.x;
      const distance=Math.hypot(wx-gapCenter.x,wy-gapCenter.y);
      const pointerDistance=state.pointer.active?Math.hypot(wx-state.pointer.x,wy-state.pointer.y):10000;
      const torch=Math.max(0,1-pointerDistance/140)*.2;
      const wave=pulseAge>=0&&pulseAge<3?Math.exp(-Math.pow((distance-pulseRadius)/26,2))*.6:0;
      const ripple=Math.sin(wx*.018+wy*.035-state.time*1.5)*.028;
      tone=Math.max(.06,Math.min(1,tone+torch+wave+ripple));
      const ramp=isRobot?ramps.robot:ramps.human;
      let glyph=ramp[Math.max(1,Math.min(ramp.length-1,Math.floor(tone*(ramp.length-1))))];
      const flicker=1+Math.sin(state.time*2+col*.12+row*.3)*.035;
      const brightness=Math.round(Math.min(252,(110+tone*145)*flicker)*alpha);
      const sparkLight=Math.max(0,1-distance/140)*energy;
      if(wave>.12||sparkLight>.2)ctx.fillStyle=`rgb(${Math.min(255,brightness+24)},${Math.min(255,brightness+30)},${Math.max(0,brightness-12)})`;
      else ctx.fillStyle=`rgb(${brightness},${Math.min(255,brightness+2)},${Math.max(0,brightness-5)})`;
      ctx.fillText(glyph,wx,(row+.5)*ch);
      frame[row][col]=glyph;
    }
  }
  const centerX=gapCenter.x,centerY=gapCenter.y+(robotY+humanY)/2;
  // Energy is also text: +, -, /, * and x instead of painted particles.
  if(energy>.07){
    ctx.fillStyle=`rgba(223,245,190,${Math.min(1,energy+.2)})`;
    for(let i=0;i<13;i++){
      const x=HAND_ANCHORS.robot.x+reach+i*(HAND_ANCHORS.human.x-HAND_ANCHORS.robot.x-reach*2)/12;
      const t=i/12;
      const y=(HAND_ANCHORS.robot.y+robotY)*(1-t)+(HAND_ANCHORS.human.y+humanY)*t+Math.sin(i*2.2+state.time*18)*2.5*energy*Math.sin(t*Math.PI);
      const col=Math.floor(x/cw),row=Math.floor((y+yOffset)/ch);
      const glyph=i===6?'*':i%3===0?'+':'-';
      ctx.fillText(glyph,(col+.5)*cw,(row+.5)*ch);
      if(frame[row]?.[col]!==undefined)frame[row][col]=glyph;
    }
    for(let i=0;i<18;i++){
      const angle=i*2.399+state.time*.12;
      const radius=(13+(i*13+state.time*32)%65)*energy;
      const x=centerX+Math.cos(angle)*radius,y=centerY+Math.sin(angle)*radius*.8;
      const col=Math.floor(x/cw),row=Math.floor((y+yOffset)/ch);
      if(frame[row]?.[col]===' '){const glyph=i%4===0?'+':i%3===0?'x':'.';ctx.fillText(glyph,(col+.5)*cw,(row+.5)*ch);frame[row][col]=glyph;}
    }
  }
  state.frame=frame.map(row=>row.join(''));
}

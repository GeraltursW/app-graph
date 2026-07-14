<script setup>
import Icon from '@/components/Icon/Icon.vue';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { buildImageApiUrl } from '../info.api';
import GraphButton from './shared/GraphButton.vue';

gsap.registerPlugin(ScrollTrigger);

const open = ref(false);
const overlayRef = ref(null);
const scrollerRef = ref(null);
let animationContext = null;

const stages = [
  {
    number: '01',
    eyebrow: 'DESIGN SYSTEM',
    title: '定义页面与动作模型',
    text: '先确定页面去重、动作分类和边关系，让 AI 识别结果能够被人工理解、复核与持续修正。',
    image: 'qq_demo_001.svg',
    tags: ['Page Hash', 'Action Model', 'Review Flow'],
  },
  {
    number: '02',
    eyebrow: 'DEVICE SCRIPT',
    title: '让脚本在真实设备探索',
    text: 'HDC 脚本执行点击、滑动和长按，持续采集截图、控件语义、页面 URL 与跳转证据。',
    image: 'qq_demo_033.svg',
    tags: ['HDC', 'Screenshot', 'AI Vision'],
  },
  {
    number: '03',
    eyebrow: 'DATA ENGINE',
    title: '后端沉淀可演进图谱',
    text: 'FastAPI、PostgreSQL 与 pgvector 负责去重、版本化、动作复核和增量遍历，保存每次发现的依据。',
    image: 'qq_demo_088.svg',
    tags: ['FastAPI', 'PostgreSQL', 'pgvector'],
  },
  {
    number: '04',
    eyebrow: 'GRAPH EXPERIENCE',
    title: '前端把复杂关系变得可读',
    text: 'G6 将页面、截图、控件边和功能分区组织成可搜索、可编辑、可回放的应用地图。',
    image: 'qq_demo_145.svg',
    tags: ['AntV G6', 'Vue 3', 'Replay Path'],
  },
];

async function openJourney() {
  open.value = true;
  await nextTick();
  setupAnimations();
}

function closeJourney() {
  animationContext?.revert();
  animationContext = null;
  ScrollTrigger.getAll().forEach((trigger) => {
    if (trigger.vars.scroller === scrollerRef.value) trigger.kill();
  });
  open.value = false;
}

function setupAnimations() {
  animationContext?.revert();
  animationContext = gsap.context(() => {
    gsap.from('.promo-hero-copy > *', {
      y: 34,
      opacity: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: 'power3.out',
    });

    gsap.utils.toArray('.journey-stage').forEach((stage, index) => {
      const copy = stage.querySelector('.journey-copy');
      const visual = stage.querySelector('.journey-visual');
      gsap.from(copy, {
        x: index % 2 === 0 ? -130 : 130,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: stage,
          scroller: scrollerRef.value,
          start: 'top 74%',
          toggleActions: 'play none none reverse',
        },
      });
      gsap.from(visual, {
        x: index % 2 === 0 ? 90 : -90,
        y: 30,
        opacity: 0,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: stage,
          scroller: scrollerRef.value,
          start: 'top 70%',
          toggleActions: 'play none none reverse',
        },
      });
    });

    gsap.fromTo('.journey-path-progress', {
      strokeDashoffset: 1,
    }, {
      strokeDashoffset: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '.journey-track',
        scroller: scrollerRef.value,
        start: 'top 36%',
        end: 'bottom 64%',
        scrub: 0.7,
      },
    });

    gsap.to('.journey-meteor', {
      strokeDashoffset: -1,
      ease: 'none',
      scrollTrigger: {
        trigger: '.journey-track',
        scroller: scrollerRef.value,
        start: 'top 36%',
        end: 'bottom 64%',
        scrub: 0.45,
      },
    });
  }, overlayRef.value);
  ScrollTrigger.refresh();
}

onBeforeUnmount(() => animationContext?.revert());
</script>

<template>
  <GraphButton class="promo-entry" type="primary" html-type="button" @click="openJourney">
    <template #icon><Icon icon="ant-design:rocket-outlined" :size="14" /></template>
    项目旅程
  </GraphButton>

  <Teleport to="body">
    <div v-if="open" ref="overlayRef" class="promo-overlay" role="dialog" aria-modal="true" aria-label="项目宣传页">
      <GraphButton class="promo-close" icon-only html-type="button" aria-label="关闭宣传页" @click="closeJourney">
        <template #icon><Icon icon="ant-design:close-outlined" :size="18" /></template>
      </GraphButton>

      <div ref="scrollerRef" class="promo-scroller">
        <header class="promo-hero" :style="{ '--promo-hero-image': `url(${buildImageApiUrl('qq_demo_001.svg')})` }">
          <div class="promo-hero-copy">
            <span>APP GRAPH INTELLIGENCE</span>
            <h2>从一张截图，到一张可验证的应用地图</h2>
            <p>设计模型、设备探索、数据沉淀与图谱体验，四个阶段构成持续增长的移动应用认知系统。</p>
          </div>
          <div class="promo-scroll-hint">
            <Icon icon="ant-design:arrow-down-outlined" :size="15" />
            滚动探索
          </div>
        </header>

        <main class="journey-track">
          <svg class="journey-line" viewBox="0 0 1000 3200" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id="journey-glow" x="-60%" y="-20%" width="220%" height="140%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path class="journey-path-base" d="M500 190 C730 420 260 690 500 950 S740 1450 500 1750 S270 2260 500 2530 S690 2860 500 3070" />
            <path class="journey-path-progress" pathLength="1" d="M500 190 C730 420 260 690 500 950 S740 1450 500 1750 S270 2260 500 2530 S690 2860 500 3070" />
            <path class="journey-meteor" pathLength="1" d="M500 190 C730 420 260 690 500 950 S740 1450 500 1750 S270 2260 500 2530 S690 2860 500 3070" />
          </svg>

          <section
            v-for="(stage, index) in stages"
            :key="stage.number"
            class="journey-stage"
            :class="{ reversed: index % 2 === 1 }"
          >
            <article class="journey-copy">
              <span class="journey-number">{{ stage.number }}</span>
              <em>{{ stage.eyebrow }}</em>
              <h3>{{ stage.title }}</h3>
              <p>{{ stage.text }}</p>
              <div class="journey-tags"><span v-for="tag in stage.tags" :key="tag">{{ tag }}</span></div>
            </article>
            <div class="journey-node" aria-hidden="true">{{ stage.number }}</div>
            <figure class="journey-visual">
              <img :src="buildImageApiUrl(stage.image)" :alt="`${stage.title} 页面截图`" />
              <figcaption>
                <Icon icon="ant-design:mobile-outlined" :size="16" />
                {{ stage.eyebrow }} / LIVE EVIDENCE
              </figcaption>
            </figure>
          </section>
        </main>

        <footer class="promo-footer">
          <span>APPLICATION MAP</span>
          <h2>让每一次探索，都成为下一次判断的证据。</h2>
          <GraphButton type="primary" html-type="button" @click="closeJourney">返回图谱</GraphButton>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.promo-entry { min-width: 104px; }
.promo-overlay { position: fixed; z-index: 10000; inset: 0; background: #06152a; color: #fff; }
.promo-scroller { height: 100%; overflow-x: hidden; overflow-y: auto; scroll-behavior: smooth; }
.promo-close { position: fixed; z-index: 4; top: 24px; right: 28px; width: 38px; height: 38px; border-color: rgba(255,255,255,.28); background: rgba(5,18,38,.78); color: #fff; backdrop-filter: blur(10px); }
.promo-hero { position: relative; display: grid; min-height: 92vh; place-items: center; padding: 80px 8vw 110px; overflow: hidden; background: #07172f; text-align: center; }
.promo-hero::before { position: absolute; inset: 0; background: var(--promo-hero-image) center 18% / min(540px,72vw) auto no-repeat; content: ''; opacity: .28; transform: scale(1.08); }
.promo-hero::after { position: absolute; inset: 0; background: rgba(3,14,31,.66); content: ''; }
.promo-hero-copy,.promo-scroll-hint { z-index: 1; }
.promo-hero-copy { display: grid; max-width: 900px; gap: 20px; }
.promo-hero-copy > span,.journey-copy em,.promo-footer > span { color: #67e8f9; font-size: 12px; font-style: normal; font-weight: 800; letter-spacing: .18em; }
.promo-hero h2 { margin: 0; color: #fff; font-size: clamp(40px,6vw,78px); font-weight: 720; line-height: 1.08; letter-spacing: 0; text-shadow: 0 10px 36px rgba(0,0,0,.45); }
.promo-hero p { max-width: 700px; margin: 0 auto; color: #b8c9df; font-size: 17px; line-height: 1.8; }
.promo-scroll-hint { position: absolute; bottom: 34px; display: flex; align-items: center; gap: 8px; color: #9cc8ff; font-size: 12px; }
.journey-track { position: relative; width: min(1240px,94vw); margin: 0 auto; }
.journey-line { position: absolute; z-index: 0; inset: 0; width: 100%; height: 100%; overflow: visible; }
.journey-path-base,.journey-path-progress,.journey-meteor { fill: none; vector-effect: non-scaling-stroke; }
.journey-path-base { stroke: rgba(113,167,235,.18); stroke-width: 3; }
.journey-path-progress { stroke: #38bdf8; stroke-width: 4; stroke-dasharray: 1; filter: url(#journey-glow); }
.journey-meteor { stroke: #fff; stroke-width: 9; stroke-linecap: round; stroke-dasharray: .035 .965; filter: url(#journey-glow); }
.journey-stage { position: relative; z-index: 1; display: grid; min-height: 800px; grid-template-columns: minmax(0,1fr) 90px minmax(0,1fr); align-items: center; gap: 42px; padding: 90px 4vw; }
.journey-stage.reversed .journey-copy { grid-column: 3; grid-row: 1; }
.journey-stage.reversed .journey-visual { grid-column: 1; grid-row: 1; }
.journey-copy { display: grid; gap: 14px; }
.journey-number { color: rgba(147,197,253,.22); font-size: 96px; font-weight: 800; line-height: .9; }
.journey-copy h3 { margin: 0; font-size: 34px; line-height: 1.2; letter-spacing: 0; }
.journey-copy p { margin: 0; color: #afc1d8; font-size: 15px; line-height: 1.9; }
.journey-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.journey-tags span { padding: 6px 9px; border: 1px solid rgba(103,232,249,.24); border-radius: 4px; background: rgba(8,47,73,.4); color: #a5f3fc; font-size: 11px; }
.journey-node { display: grid; width: 58px; height: 58px; grid-column: 2; grid-row: 1; place-items: center; border: 1px solid #7dd3fc; border-radius: 50%; background: #071f3e; color: #fff; font-size: 13px; font-weight: 800; box-shadow: 0 0 0 9px rgba(14,165,233,.09),0 0 34px rgba(56,189,248,.5); }
.journey-visual { position: relative; display: grid; max-width: 420px; min-height: 520px; margin: 0; justify-self: center; place-items: center; overflow: hidden; border: 1px solid rgba(125,211,252,.3); border-radius: 8px; background: linear-gradient(150deg,rgba(18,56,97,.95),rgba(6,22,45,.86)); box-shadow: 0 30px 70px rgba(0,0,0,.38); }
.journey-visual img { width: min(230px,70%); max-height: 440px; object-fit: contain; filter: drop-shadow(0 22px 25px rgba(0,0,0,.4)); }
.journey-visual figcaption { position: absolute; right: 16px; bottom: 14px; left: 16px; display: flex; align-items: center; gap: 8px; color: #8dc7f7; font-size: 10px; font-weight: 700; letter-spacing: .1em; }
.promo-footer { display: grid; min-height: 76vh; place-items: center; align-content: center; gap: 22px; padding: 80px 8vw; background: #041020; text-align: center; }
.promo-footer h2 { max-width: 780px; margin: 0; font-size: clamp(34px,5vw,62px); line-height: 1.18; letter-spacing: 0; }
@media (max-width: 760px) { .journey-line { left: 22px; width: 40px; } .journey-stage,.journey-stage.reversed { min-height: 760px; grid-template-columns: 54px 1fr; gap: 18px; padding: 80px 20px; } .journey-node { grid-column: 1; grid-row: 1; width: 44px; height: 44px; } .journey-copy,.journey-stage.reversed .journey-copy { grid-column: 2; grid-row: 1; } .journey-visual,.journey-stage.reversed .journey-visual { grid-column: 2; grid-row: 2; min-height: 420px; } .journey-number { font-size: 66px; } .promo-hero h2 { font-size: 42px; } }
</style>

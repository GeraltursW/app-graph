<script setup>
import Icon from '@/components/Icon/Icon.vue';
import gsap from 'gsap';
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { buildImageApiUrl } from '../info.api';
import GraphButton from './shared/GraphButton.vue';

const open = ref(false);
const paused = ref(false);
const activeScene = ref(0);
const overlayRef = ref(null);
const progressRef = ref(null);
let animationContext = null;
let playback = null;
let previousBodyOverflow = '';

// Each scene remains fully visible for 4.5 seconds before transitioning.
const holdDuration = 4.5;

const scenes = [
  {
    id: 'overview',
    number: '00',
    eyebrow: 'APP GRAPH INTELLIGENCE',
    title: '看见应用里，每一次页面抵达',
    text: 'App Graph 将真实设备采集的页面、控件动作与跳转证据，组织成可探索、可编辑、可复核的移动应用关系图谱。',
    image: 'qq_demo_001.svg',
    secondaryImage: 'qq_demo_033.svg',
    tags: ['页面关系图谱', 'AI 探索', '人工复核'],
    metric: '300',
    metricLabel: 'QQ 演示节点',
  },
  {
    id: 'generate',
    number: '01',
    eyebrow: 'PROCESS 01 / GRAPH GENERATION',
    title: '图谱生成：从设备证据开始',
    text: 'HDC 脚本在真实手机执行点击、滑动与长按，AI 同步识别截图、页面 URL、控件语义和页面结构。后端以结构哈希完成页面去重，让动态内容回归同一个功能页面。',
    image: 'qq_demo_045.svg',
    tags: ['HDC Script', 'AI Vision', 'Structure Hash'],
    facts: ['采集截图与 OCR', '识别控件和动作', '生成页面跳转边'],
  },
  {
    id: 'explore',
    number: '02',
    eyebrow: 'PROCESS 02 / EXPLORE & EDIT',
    title: '探索编辑：让未知页面有归属',
    text: '无法自动覆盖的支付、授权和条件页面不会被丢弃，而是进入游离 URL 区。AI 给出可能归属，用户也能拖拽并入主树，持续扩展已有图谱而不破坏原结构。',
    image: 'qq_demo_118.svg',
    tags: ['Orphan URL', 'AI Inference', 'Drag to Merge'],
    facts: ['AI 探索游离页面', '人工拖拽调整结构', '增量遍历持续扩图'],
  },
  {
    id: 'review',
    number: '03',
    eyebrow: 'PROCESS 03 / HUMAN REVIEW',
    title: '人工复核：AI 判断必须能被质疑',
    text: 'Inspector 同时展示页面证据、推理结果与动作分层。复核人员可以修改描述、截图和动作对象，并将弹窗、状态、外部调用、页面跳转作为完整结果保存。',
    image: 'qq_demo_206.svg',
    tags: ['Inspector', 'Action Model', 'Evidence Review'],
    facts: ['四类 action 整体复核', '多截图证据切换', '人工结果优先落库'],
  },
  {
    id: 'architecture',
    number: '04',
    eyebrow: 'ENGINEERING FOUNDATION',
    title: '一套面向规模化覆盖的工程底座',
    text: 'Vue 3 与 AntV G6 提供高性能交互，FastAPI、PostgreSQL 和 pgvector 保存图结构、页面证据与向量语义，为市场头部应用覆盖和路径回放提供基础。',
    image: 'qq_demo_260.svg',
    tags: ['Vue 3 + G6', 'FastAPI', 'PostgreSQL + pgvector'],
    architecture: ['设备脚本', 'AI 识别', '数据引擎', '应用图谱'],
  },
];

async function openJourney() {
  open.value = true;
  paused.value = false;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  await nextTick();
  setupPlayback();
}

function closeJourney() {
  destroyPlayback();
  document.body.style.overflow = previousBodyOverflow;
  open.value = false;
}

function destroyPlayback() {
  playback?.kill();
  playback = null;
  animationContext?.revert();
  animationContext = null;
}

function setupPlayback() {
  destroyPlayback();
  animationContext = gsap.context(() => {
    const sceneElements = gsap.utils.toArray('.promo-scene');
    gsap.set(sceneElements, { autoAlpha: 0, zIndex: 0 });
    gsap.set(progressRef.value, { scaleX: 0, transformOrigin: 'left center' });

    playback = gsap.timeline({
      repeat: -1,
      repeatDelay: 0.45,
      defaults: { ease: 'power3.out' },
      onRepeat: () => {
        activeScene.value = 0;
      },
      onUpdate: () => {
        if (progressRef.value && playback) {
          gsap.set(progressRef.value, { scaleX: playback.progress() });
        }
      },
    });

    sceneElements.forEach((scene, index) => {
      const copy = scene.querySelector('.promo-scene-copy');
      const visual = scene.querySelector('.promo-scene-visual');
      const direction = index % 2 === 0 ? -1 : 1;

      playback
        .set(scene, { autoAlpha: 1, zIndex: 2 })
        .call(() => {
          activeScene.value = index;
        })
        .fromTo(copy, {
          x: direction * 150,
          opacity: 0,
        }, {
          x: 0,
          opacity: 1,
          duration: 0.9,
        })
        .fromTo(visual, {
          x: direction * -110,
          y: 30,
          opacity: 0,
          scale: 0.96,
        }, {
          x: 0,
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 1.05,
        }, '<0.08')
        .from(scene.querySelectorAll('.promo-tag, .promo-fact'), {
          y: 16,
          opacity: 0,
          duration: 0.45,
          stagger: 0.07,
        }, '<0.28')
        .to({}, { duration: holdDuration })
        .to(scene, {
          autoAlpha: 0,
          y: -18,
          duration: 0.65,
          ease: 'power2.inOut',
        })
        .set(scene, { zIndex: 0, y: 0 });
    });
  }, overlayRef.value);
}

function togglePlayback() {
  if (!playback) return;
  paused.value = !paused.value;
  playback.paused(paused.value);
}

function restartPlayback() {
  if (!playback) return;
  paused.value = false;
  playback.restart();
}

onBeforeUnmount(() => {
  destroyPlayback();
  if (open.value) document.body.style.overflow = previousBodyOverflow;
});
</script>

<template>
  <GraphButton class="promo-entry" type="primary" html-type="button" @click="openJourney">
    <template #icon><Icon icon="ant-design:rocket-outlined" :size="14" /></template>
    项目旅程
  </GraphButton>

  <Teleport to="body">
    <div
      v-if="open"
      ref="overlayRef"
      class="promo-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="App Graph 自动介绍页"
      @wheel.prevent
      @touchmove.prevent
    >
      <div class="promo-progress" aria-hidden="true"><span ref="progressRef" /></div>

      <header class="promo-player-head">
        <div class="promo-brand">
          <span class="promo-brand-mark"><Icon icon="ant-design:deployment-unit-outlined" :size="18" /></span>
          <div><strong>APP GRAPH</strong><small>PRODUCT STORY</small></div>
        </div>
        <span class="promo-counter">{{ String(activeScene + 1).padStart(2, '0') }} / {{ String(scenes.length).padStart(2, '0') }}</span>
        <div class="promo-player-actions">
          <GraphButton icon-only html-type="button" aria-label="重新播放" title="重新播放" @click="restartPlayback">
            <template #icon><Icon icon="ant-design:reload-outlined" :size="16" /></template>
          </GraphButton>
          <GraphButton icon-only html-type="button" :aria-label="paused ? '继续播放' : '暂停播放'" :title="paused ? '继续播放' : '暂停播放'" @click="togglePlayback">
            <template #icon><Icon :icon="paused ? 'ant-design:caret-right-filled' : 'ant-design:pause-outlined'" :size="16" /></template>
          </GraphButton>
          <GraphButton icon-only html-type="button" aria-label="关闭宣传页" title="关闭宣传页" @click="closeJourney">
            <template #icon><Icon icon="ant-design:close-outlined" :size="17" /></template>
          </GraphButton>
        </div>
      </header>

      <main class="promo-stage">
        <section
          v-for="(scene, index) in scenes"
          :key="scene.id"
          class="promo-scene"
          :class="[`scene-${scene.id}`, { reversed: index % 2 === 1 }]"
        >
          <article class="promo-scene-copy">
            <span class="promo-scene-number">{{ scene.number }}</span>
            <em>{{ scene.eyebrow }}</em>
            <h2>{{ scene.title }}</h2>
            <p>{{ scene.text }}</p>
            <div class="promo-tags">
              <span v-for="tag in scene.tags" :key="tag" class="promo-tag">{{ tag }}</span>
            </div>
            <div v-if="scene.facts" class="promo-facts">
              <span v-for="fact in scene.facts" :key="fact" class="promo-fact">
                <Icon icon="ant-design:check-circle-filled" :size="14" />{{ fact }}
              </span>
            </div>
          </article>

          <div class="promo-scene-visual">
            <template v-if="scene.id === 'overview'">
              <div class="promo-phone-stack">
                <img :src="buildImageApiUrl(scene.secondaryImage)" alt="QQ 页面识别结果" />
                <img :src="buildImageApiUrl(scene.image)" alt="QQ 首页识别结果" />
              </div>
              <div class="promo-metric"><strong>{{ scene.metric }}</strong><span>{{ scene.metricLabel }}</span></div>
              <div class="promo-edge edge-one">点击消息</div>
              <div class="promo-edge edge-two">打开功能页</div>
            </template>

            <template v-else-if="scene.id === 'architecture'">
              <div class="architecture-flow">
                <div v-for="(item, flowIndex) in scene.architecture" :key="item">
                  <span><Icon :icon="['ant-design:mobile-outlined','ant-design:eye-outlined','ant-design:database-outlined','ant-design:deployment-unit-outlined'][flowIndex]" :size="22" /></span>
                  <strong>{{ item }}</strong>
                  <Icon v-if="flowIndex < scene.architecture.length - 1" class="architecture-arrow" icon="ant-design:arrow-right-outlined" :size="18" />
                </div>
              </div>
              <img class="architecture-shot" :src="buildImageApiUrl(scene.image)" alt="应用图谱页面截图" />
            </template>

            <template v-else>
              <div class="promo-evidence-label"><span>LIVE EVIDENCE</span><strong>{{ scene.number }}</strong></div>
              <img class="promo-phone" :src="buildImageApiUrl(scene.image)" :alt="`${scene.title} 页面截图`" />
              <div class="promo-signal signal-a" />
              <div class="promo-signal signal-b" />
              <div class="promo-signal signal-c" />
            </template>
          </div>
        </section>
      </main>

      <footer class="promo-player-foot">
        <span>DESIGN</span><i /><span>DEVICE SCRIPT</span><i /><span>DATA ENGINE</span><i /><span>GRAPH EXPERIENCE</span>
      </footer>
    </div>
  </Teleport>
</template>

<style scoped>
.promo-entry { min-width: 104px; }
.promo-overlay { position: fixed; z-index: 10000; inset: 0; overflow: hidden; background: #f4f8fd; color: #102a4c; font-family: Inter,"PingFang SC","Microsoft YaHei",sans-serif; }
.promo-progress { position: absolute; z-index: 8; top: 0; right: 0; left: 0; height: 4px; background: #dce9f8; }
.promo-progress span { display: block; width: 100%; height: 100%; background: #1677ff; transform: scaleX(0); }
.promo-player-head { position: absolute; z-index: 7; top: 0; right: 0; left: 0; display: grid; height: 82px; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 0 38px; border-bottom: 1px solid #dce6f2; background: rgba(255,255,255,.93); }
.promo-brand { display: flex; align-items: center; gap: 10px; }
.promo-brand-mark { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 6px; background: #1677ff; color: #fff; }
.promo-brand div { display: grid; gap: 2px; }
.promo-brand strong { color: #102a4c; font-size: 13px; letter-spacing: .08em; }
.promo-brand small { color: #7590ad; font-size: 9px; letter-spacing: .18em; }
.promo-counter { color: #52708f; font-family: ui-monospace,SFMono-Regular,Menlo,monospace; font-size: 12px; font-weight: 700; }
.promo-player-actions { display: flex; justify-content: flex-end; gap: 8px; }
.promo-player-actions :deep(.graph-button) { width: 34px; height: 34px; border-color: #cbd9ea; background: #fff; color: #3e6389; }
.promo-stage { position: absolute; z-index: 2; inset: 82px 0 42px; }
.promo-scene { position: absolute; inset: 0; display: grid; grid-template-columns: minmax(360px,.9fr) minmax(480px,1.1fr); align-items: center; gap: 7vw; padding: 54px max(7vw,70px); visibility: hidden; }
.promo-scene.reversed .promo-scene-copy { grid-column: 2; grid-row: 1; }
.promo-scene.reversed .promo-scene-visual { grid-column: 1; grid-row: 1; }
.promo-scene-copy { position: relative; z-index: 2; display: grid; max-width: 620px; gap: 17px; }
.promo-scene-number { position: absolute; z-index: -1; top: -105px; left: -30px; color: #e0ecfa; font-size: 132px; font-weight: 800; line-height: 1; }
.promo-scene-copy em { color: #1677ff; font-size: 11px; font-style: normal; font-weight: 800; letter-spacing: .15em; }
.promo-scene-copy h2 { margin: 0; color: #102a4c; font-size: 46px; font-weight: 720; line-height: 1.18; letter-spacing: 0; }
.scene-overview .promo-scene-copy h2 { font-size: 56px; }
.promo-scene-copy p { margin: 0; color: #526b86; font-size: 15px; line-height: 1.9; }
.promo-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.promo-tag { padding: 6px 9px; border: 1px solid #bdd6f2; border-radius: 4px; background: #fff; color: #2563a5; font-size: 11px; font-weight: 700; }
.promo-facts { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; margin-top: 4px; }
.promo-fact { display: flex; align-items: center; gap: 6px; padding: 9px; border-left: 2px solid #3b82f6; background: #eaf3ff; color: #385b7f; font-size: 11px; font-weight: 700; }
.promo-fact :deep(svg) { color: #1677ff; }
.promo-scene-visual { position: relative; display: grid; min-height: 560px; place-items: center; }
.promo-scene-visual::before { position: absolute; width: 500px; height: 500px; border: 1px solid #d4e4f6; border-radius: 50%; background: #eaf3fd; content: ''; }
.promo-phone { position: relative; z-index: 2; width: 248px; max-height: 500px; border: 8px solid #fff; border-radius: 22px; background: #fff; box-shadow: 0 26px 64px rgba(36,88,145,.2); object-fit: contain; }
.promo-evidence-label { position: absolute; z-index: 3; top: 30px; right: 9%; display: grid; gap: 3px; padding: 11px 14px; border: 1px solid #b9d4f2; border-radius: 5px; background: #fff; box-shadow: 0 12px 28px rgba(37,88,143,.12); }
.promo-evidence-label span { color: #7290ae; font-size: 9px; letter-spacing: .14em; }
.promo-evidence-label strong { color: #1677ff; font-size: 20px; }
.promo-signal { position: absolute; z-index: 1; border: 1px solid #8dbcf0; border-radius: 50%; }
.signal-a { width: 350px; height: 350px; }
.signal-b { width: 430px; height: 430px; opacity: .65; }
.signal-c { width: 510px; height: 510px; opacity: .35; }
.promo-phone-stack { position: relative; z-index: 2; width: 430px; height: 500px; }
.promo-phone-stack img { position: absolute; width: 225px; max-height: 460px; border: 7px solid #fff; border-radius: 20px; background: #fff; box-shadow: 0 24px 58px rgba(38,86,140,.2); object-fit: contain; }
.promo-phone-stack img:first-child { top: 24px; left: 20px; opacity: .72; transform: rotate(-7deg); }
.promo-phone-stack img:last-child { right: 20px; bottom: 6px; transform: rotate(5deg); }
.promo-metric { position: absolute; z-index: 4; right: 3%; bottom: 48px; display: grid; padding: 14px 18px; border-left: 3px solid #1677ff; background: #fff; box-shadow: 0 14px 34px rgba(38,86,140,.14); }
.promo-metric strong { color: #1677ff; font-size: 34px; line-height: 1; }
.promo-metric span { margin-top: 5px; color: #607b98; font-size: 10px; }
.promo-edge { position: absolute; z-index: 4; padding: 7px 10px; border-radius: 4px; background: #1677ff; color: #fff; font-size: 10px; font-weight: 700; box-shadow: 0 8px 20px rgba(22,119,255,.22); }
.edge-one { top: 100px; left: 4%; }.edge-two { top: 230px; right: 0; }
.architecture-flow { position: absolute; z-index: 3; top: 64px; right: 0; left: 0; display: flex; align-items: center; justify-content: center; gap: 10px; }
.architecture-flow > div { position: relative; display: grid; width: 105px; gap: 7px; place-items: center; }
.architecture-flow span { display: grid; width: 48px; height: 48px; place-items: center; border: 1px solid #b8d2ef; border-radius: 8px; background: #fff; color: #1677ff; box-shadow: 0 10px 24px rgba(46,93,146,.1); }
.architecture-flow strong { color: #355777; font-size: 11px; }
.architecture-arrow { position: absolute; top: 15px; right: -15px; color: #87a9cc; }
.architecture-shot { position: relative; z-index: 2; width: 220px; max-height: 410px; margin-top: 100px; border: 7px solid #fff; border-radius: 18px; box-shadow: 0 24px 58px rgba(38,86,140,.2); object-fit: contain; }
.promo-player-foot { position: absolute; z-index: 7; right: 0; bottom: 0; left: 0; display: flex; height: 42px; align-items: center; justify-content: center; gap: 13px; border-top: 1px solid #dce6f2; background: rgba(255,255,255,.94); color: #7b94ad; font-size: 9px; font-weight: 700; letter-spacing: .12em; }
.promo-player-foot i { width: 24px; height: 1px; background: #bdd0e5; }
@media (max-width: 980px) { .promo-scene { grid-template-columns: 1fr 1fr; gap: 28px; padding: 48px 38px; } .promo-scene-copy h2,.scene-overview .promo-scene-copy h2 { font-size: 38px; } .promo-facts { grid-template-columns: 1fr; } .promo-scene-visual { min-height: 480px; transform: scale(.86); } }
@media (max-width: 720px) { .promo-player-head { height: 68px; padding: 0 16px; grid-template-columns: 1fr auto; } .promo-counter { display: none; } .promo-stage { inset: 68px 0 34px; } .promo-brand small,.promo-player-foot { display: none; } .promo-scene,.promo-scene.reversed { grid-template-columns: 1fr; align-content: center; gap: 16px; padding: 30px 22px; } .promo-scene-copy,.promo-scene.reversed .promo-scene-copy { grid-column: 1; grid-row: 1; gap: 10px; } .promo-scene-visual,.promo-scene.reversed .promo-scene-visual { min-height: 330px; grid-column: 1; grid-row: 2; transform: scale(.7); transform-origin: top center; } .promo-scene-number { top: -48px; left: -4px; font-size: 70px; } .promo-scene-copy h2,.scene-overview .promo-scene-copy h2 { font-size: 30px; } .promo-scene-copy p { font-size: 13px; line-height: 1.65; } .promo-tags,.promo-facts { display: none; } }
</style>

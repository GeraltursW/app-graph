<script setup>
import Icon from '@/components/Icon/Icon.vue';
import {
  Button as AButton,
  CheckboxGroup as ACheckboxGroup,
  Input as AInput,
  InputNumber as AInputNumber,
  Modal as AModal,
  Select as ASelect,
  SelectOption as ASelectOption,
} from 'ant-design-vue';
import { computed, reactive, watch } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  pages: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:open', 'create']);

const metricOptions = ['CPU', '内存', 'FPS', 'Jank', '功耗', '温度'];
const operationOptions = [
  { value: 'wait', label: '等待' },
  { value: 'swipe', label: '滑动' },
  { value: 'long_press', label: '长按' },
  { value: 'tap', label: '点击' },
];
const presets = {
  scroll: [
    { type: 'wait', label: '等待页面稳定', target: '当前页面', duration_ms: 1500, repeat: 1, direction: 'up' },
    { type: 'swipe', label: '连续向上滑动', target: '页面内容区', duration_ms: 420, repeat: 5, direction: 'up' },
    { type: 'wait', label: '内容停留', target: '当前页面', duration_ms: 1800, repeat: 1, direction: 'up' },
  ],
  longPress: [
    { type: 'wait', label: '等待页面稳定', target: '当前页面', duration_ms: 1200, repeat: 1, direction: 'up' },
    { type: 'long_press', label: '长按核心内容', target: '核心内容区', duration_ms: 800, repeat: 1, direction: 'up' },
    { type: 'wait', label: '观察交互结果', target: '当前页面', duration_ms: 1200, repeat: 1, direction: 'up' },
  ],
  mixed: [
    { type: 'swipe', label: '向上浏览内容', target: '页面内容区', duration_ms: 420, repeat: 3, direction: 'up' },
    { type: 'long_press', label: '长按内容区域', target: '核心内容区', duration_ms: 800, repeat: 1, direction: 'up' },
    { type: 'swipe', label: '向下回退浏览', target: '页面内容区', duration_ms: 420, repeat: 2, direction: 'down' },
  ],
};

const draft = reactive({
  case_name: '',
  start_page_id: '',
  duration_seconds: 30,
  metrics: ['CPU', '内存', 'FPS', '功耗'],
  operations: [],
});
const canSubmit = computed(() => (
  draft.case_name.trim()
  && draft.start_page_id
  && draft.operations.length
  && draft.metrics.length
));

watch(() => props.open, (open) => {
  if (!open) return;
  if (!draft.start_page_id) draft.start_page_id = props.pages[0]?.nodeId || '';
  if (!draft.operations.length) applyPreset('scroll');
});

function applyPreset(key) {
  draft.operations = presets[key].map((item) => ({ ...item }));
  if (!draft.case_name) {
    draft.case_name = {
      scroll: '页面连续滑动性能',
      longPress: '页面长按交互性能',
      mixed: '混合操作性能',
    }[key];
  }
}

function addOperation() {
  draft.operations.push({
    type: 'swipe',
    label: '新增操作',
    target: '页面内容区',
    duration_ms: 420,
    repeat: 1,
    direction: 'up',
  });
}

function removeOperation(index) {
  draft.operations.splice(index, 1);
}

function moveOperation(index, offset) {
  const target = index + offset;
  if (target < 0 || target >= draft.operations.length) return;
  const [item] = draft.operations.splice(index, 1);
  draft.operations.splice(target, 0, item);
}

function submit() {
  if (!canSubmit.value) return;
  emit('create', {
    case_id: `custom-scenario-${Date.now()}`,
    case_name: draft.case_name.trim(),
    case_type: 'scenario',
    source: 'user_configured',
    description: `用户配置的过程采集用例，包含 ${draft.operations.length} 类操作组合。`,
    start_page_id: draft.start_page_id,
    operations: draft.operations.map((item) => ({ ...item })),
    collection: {
      trigger: 'case_lifecycle',
      duration_seconds: draft.duration_seconds,
      metrics: [...draft.metrics],
    },
  });
  emit('update:open', false);
}
</script>

<template>
  <a-modal
    :open="open"
    width="760px"
    title="配置过程采集用例"
    ok-text="创建用例"
    cancel-text="取消"
    :ok-button-props="{ disabled: !canSubmit }"
    @ok="submit"
    @cancel="emit('update:open', false)"
  >
    <div class="scenario-builder">
      <section class="scenario-builder-basic">
        <label>
          <span>用例名称</span>
          <a-input v-model:value="draft.case_name" placeholder="例如：信息流连续滑动性能" />
        </label>
        <label>
          <span>起始页面</span>
          <a-select
            v-model:value="draft.start_page_id"
            show-search
            option-filter-prop="label"
            placeholder="选择图谱节点"
          >
            <a-select-option
              v-for="page in pages"
              :key="page.nodeId"
              :value="page.nodeId"
              :label="page.displayTitle"
            >
              {{ page.displayTitle }}
            </a-select-option>
          </a-select>
        </label>
        <label>
          <span>采集时长（秒）</span>
          <a-input-number v-model:value="draft.duration_seconds" :min="5" :max="600" />
        </label>
      </section>

      <section class="scenario-preset-row">
        <strong>快速组合</strong>
        <div>
          <a-button size="small" @click="applyPreset('scroll')">连续滑动</a-button>
          <a-button size="small" @click="applyPreset('longPress')">长按交互</a-button>
          <a-button size="small" @click="applyPreset('mixed')">混合操作</a-button>
        </div>
      </section>

      <section class="scenario-operation-section">
        <div class="scenario-section-head">
          <strong>操作序列</strong>
          <a-button size="small" type="dashed" @click="addOperation">
            <Icon icon="ant-design:plus-outlined" :size="13" />
            添加操作
          </a-button>
        </div>
        <div class="scenario-operation-list">
          <div v-for="(operation, index) in draft.operations" :key="index" class="scenario-operation-row">
            <span class="scenario-operation-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <a-select v-model:value="operation.type">
              <a-select-option v-for="item in operationOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </a-select-option>
            </a-select>
            <a-input v-model:value="operation.label" placeholder="操作说明" />
            <a-select v-if="operation.type === 'swipe'" v-model:value="operation.direction">
              <a-select-option value="up">向上</a-select-option>
              <a-select-option value="down">向下</a-select-option>
              <a-select-option value="left">向左</a-select-option>
              <a-select-option value="right">向右</a-select-option>
            </a-select>
            <a-input v-else v-model:value="operation.target" placeholder="控件或区域" />
            <a-input-number v-model:value="operation.repeat" :min="1" :max="50" addon-after="次" />
            <a-input-number v-model:value="operation.duration_ms" :min="100" :max="10000" :step="100" addon-after="ms" />
            <span class="scenario-operation-actions">
              <a-button type="text" size="small" :disabled="index === 0" @click="moveOperation(index, -1)">
                <Icon icon="ant-design:arrow-up-outlined" :size="13" />
              </a-button>
              <a-button type="text" size="small" :disabled="index === draft.operations.length - 1" @click="moveOperation(index, 1)">
                <Icon icon="ant-design:arrow-down-outlined" :size="13" />
              </a-button>
              <a-button type="text" danger size="small" @click="removeOperation(index)">
                <Icon icon="ant-design:delete-outlined" :size="13" />
              </a-button>
            </span>
          </div>
        </div>
      </section>

      <section class="scenario-metric-section">
        <strong>采集指标</strong>
        <a-checkbox-group v-model:value="draft.metrics" :options="metricOptions" />
      </section>
    </div>
  </a-modal>
</template>

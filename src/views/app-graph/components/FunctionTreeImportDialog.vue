<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { Modal as AModal } from 'ant-design-vue';
import { reactive, watch } from 'vue';
import GraphButton from './shared/GraphButton.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  appName: { type: String, default: '' },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(['cancel', 'submit']);
const form = reactive({
  source: 'vendor',
  vendorVersion: '',
  metadataFile: null,
  treeFile: null,
  error: '',
});

watch(() => props.open, (open) => {
  if (!open) return;
  form.source = 'vendor';
  form.vendorVersion = '';
  form.metadataFile = null;
  form.treeFile = null;
  form.error = '';
});

function selectFile(event, field) {
  form[field] = event.target.files?.[0] || null;
  form.error = '';
}

function submit() {
  if (!form.metadataFile || !form.treeFile) {
    form.error = '请选择应用元数据 JSON 和 Function Tree JSON。';
    return;
  }
  emit('submit', {
    source: form.source.trim() || 'vendor',
    vendorVersion: form.vendorVersion.trim(),
    metadataFile: form.metadataFile,
    treeFile: form.treeFile,
  });
}
</script>

<template>
  <a-modal
    :open="open"
    :footer="null"
    :mask-closable="!loading"
    title="导入最新 Function Tree"
    width="560px"
    @cancel="emit('cancel')"
  >
    <div class="function-import-dialog">
      <div class="function-import-app">
        <span>目标应用</span>
        <strong>{{ appName || '未选择应用' }}</strong>
      </div>

      <label>
        <span>数据来源</span>
        <input v-model="form.source" type="text" placeholder="例如 qq-official" />
      </label>

      <label>
        <span>厂商版本（可选）</span>
        <input v-model="form.vendorVersion" type="text" placeholder="为空时读取 metadata.appVersion" />
      </label>

      <label class="function-file-field">
        <span>应用元数据 JSON</span>
        <input type="file" accept=".json,application/json" @change="selectFile($event, 'metadataFile')" />
        <em>{{ form.metadataFile?.name || '包含 appName、appVersion 等信息' }}</em>
      </label>

      <label class="function-file-field">
        <span>Function Tree JSON</span>
        <input type="file" accept=".json,application/json" @change="selectFile($event, 'treeFile')" />
        <em>{{ form.treeFile?.name || '包含 name、level、features、children' }}</em>
      </label>

      <p class="function-import-note">
        导入成功后会自动归档旧目录、运行最新匹配策略，并刷新页面覆盖结果。
      </p>
      <p v-if="form.error" class="function-import-error">{{ form.error }}</p>

      <div class="function-import-actions">
        <GraphButton :disabled="loading" @click="emit('cancel')">取消</GraphButton>
        <GraphButton type="primary" :disabled="loading" @click="submit">
          <template #icon>
            <Icon :icon="loading ? 'ant-design:loading-outlined' : 'ant-design:cloud-upload-outlined'" :size="14" />
          </template>
          {{ loading ? '导入并匹配中' : '导入并运行匹配' }}
        </GraphButton>
      </div>
    </div>
  </a-modal>
</template>

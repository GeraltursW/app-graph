<script setup>
import Icon from '@/components/Icon/Icon.vue';
import { useMessage } from '@/hooks/web/useMessage';
import GraphButton from "./shared/GraphButton.vue";
import { computed, reactive, ref, watch } from "vue";
import SmartImage from "./shared/SmartImage.vue";
import { Badge, Card, CardContent, CardHeader, CardTitle, ScrollArea } from "./ui";
import { buildImageApiUrl } from "../info.api";
import {
  getAncestorPath,
  getIncomingEdges,
  getOutgoingEdges,
  getPageCategory,
  groupPageActions,
  normalizeImageUrls
} from "../data/graph.js";

const props = defineProps({
  graph: {
    type: Object,
    required: true
  },
  selected: {
    type: Object,
    required: true
  },
  payload: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(["save-page-review"]);
const { createMessage } = useMessage();

const previewImage = ref(null);
const editorState = ref("view");
const editMode = computed(() => editorState.value !== "view");
const saving = computed(() => editorState.value === "saving");
const saveMessage = ref("");
const form = reactive(createEmptyForm());

const detail = computed(() => {
  if (!props.payload) return null;

  if (props.selected.type === "edge") {
    const edge = props.payload;
    const fromPage = props.graph.pageMap.get(edge.from);
    const toPage = props.graph.pageMap.get(edge.to);
    return {
      mode: "edge",
      title: `${fromPage?.displayTitle || edge.from} -> ${toPage?.displayTitle || edge.to}`,
      rows: [
        ["跳转关系", `${fromPage?.displayTitle || edge.from} -> ${toPage?.displayTitle || edge.to}`],
        ["父节点控件", edge.widget_description || edge.label || "-"],
        ["动作类型", edge.action_type || "navigate"],
        ["边 ID", edge.id]
      ],
      images: [
        ...imageItemsForPage(fromPage, "来源页面"),
        ...imageItemsForPage(toPage, "目标页面")
      ],
      json: { edge, fromPage, toPage }
    };
  }

  const page = props.payload;
  const outgoing = getOutgoingEdges(props.graph, page.nodeId);
  const incoming = getIncomingEdges(props.graph, page.nodeId);
  const category = getPageCategory(page);
  const actionGroups = groupPageActions(page.pageActions);
  const imageUrls = normalizeImageUrls(page);

  return {
    mode: "node",
    title: page.displayTitle,
    imageUrls,
    rows: [
      ["页面 ID", page.pageId || "-"],
      ["页面标题", page.page_title],
      ["页面归属", page.isFloating ? "游离 URL 页面" : "主图谱页面"],
      ["页面 URL", page.page_url || "-"],
      ["AI 推断图片", page.ai_recursive ? "是" : "否"],
      ["父节点控件", page.widget_description || "-"],
      ["图谱层级", `第 ${page.level} 层`],
      ["父节点", props.graph.pageMap.get(page.parentId)?.displayTitle || "-"],
      ["上游入口", `${incoming.length} 个`],
      ["下游节点", `${outgoing.length} 个`],
      ["页面内动作", `${page.pageActions.length} 个`],
      ["复核状态", page.review_status || "pending"]
    ],
    images: imageItemsForPage(page, "主截图"),
    json: {
      nodeId: page.nodeId,
    pageId: page.pageId || "",
      backendId: page.backendId,
      page_title: page.page_title,
      page_text: page.page_text,
      image_url: page.image_url,
      image_urls: imageUrls,
      ai_recursive: page.ai_recursive,
      page_url: page.page_url,
      widget_description: page.widget_description,
      page_info: page.page_info,
      page_actions: page.pageActions,
      ai_inference: page.aiInference,
      review_status: page.review_status,
      review_note: page.review_note,
      path: getAncestorPath(props.graph, page.nodeId),
      incomingEdges: incoming,
      outgoingEdges: outgoing
    },
    analysis: {
      category,
      path: getAncestorPath(props.graph, page.nodeId),
      upstream: incoming.map((edge) => props.graph.pageMap.get(edge.from)?.displayTitle || edge.from),
      downstream: outgoing.map((edge) => props.graph.pageMap.get(edge.to)?.displayTitle || edge.to),
      navigationActions: outgoing.map((edge) => ({
        label: edge.label,
        target: props.graph.pageMap.get(edge.to)?.displayTitle || edge.to
      })),
      stateActions: actionGroups.state_change || [],
      overlayActions: actionGroups.overlay || [],
      externalActions: actionGroups.external || []
    }
  };
});

watch(() => props.payload, () => {
  hydrateForm();
  editorState.value = "view";
}, { immediate: true });

function createEmptyForm() {
  return {
    nodeId: "",
    pageId: "",
    page_title: "",
    page_text: "",
    page_url: "",
    widget_description: "",
    ai_recursive: false,
    ai_inference_label: "",
    ai_inference_reason: "",
    image_urls: [],
    new_images: [],
    review_note: ""
  };
}

function hydrateForm() {
  Object.assign(form, createEmptyForm());
  saveMessage.value = "";
  if (!props.payload || props.selected.type !== "node") return;
  const page = props.payload;
  Object.assign(form, {
    nodeId: page.nodeId,
    pageId: page.pageId || "",
    page_title: page.page_title || "",
    page_text: page.page_text || "",
    page_url: page.page_url || "",
    widget_description: page.widget_description || "",
    ai_recursive: Boolean(page.ai_recursive),
    ai_inference_label: page.aiInference?.label || "",
    ai_inference_reason: page.aiInference?.reason || "",
    image_urls: normalizeImageUrls(page),
    review_note: page.review_note || ""
  });
}

function beginEdit() {
  hydrateForm();
  editorState.value = "editing";
}

function cancelEdit() {
  hydrateForm();
  editorState.value = "view";
}
function imageItem(url, title, kind) {
  return {
    title,
    rawUrl: url,
    candidates: url ? [buildImageApiUrl(url)] : [],
    kind
  };
}

function imageItemsForPage(page, kind) {
  if (!page) return [];
  const urls = normalizeImageUrls(page);
  if (!urls.length) return [imageItem("", page.displayTitle, kind)];
  return urls.map((url, index) => imageItem(url, page.displayTitle, index === 0 ? kind : `${kind} ${index + 1}`));
}

function openImagePreview(image) {
  previewImage.value = image;
}

function handleNewImages(event) {
  form.new_images = Array.from(event.target.files || []);
}

function removeNewImage(index) {
  form.new_images.splice(index, 1);
}
function removeImage(index) {
  form.image_urls.splice(index, 1);
}

async function saveEdit() {
  if (!form.nodeId || saving.value) return;
  editorState.value = "saving";
  saveMessage.value = "";
  createMessage.loading({ content: "正在保存页面复核...", key: "app-graph-save-review", duration: 0 });
  const review = {
    nodeId: form.nodeId,
    page_title: form.page_title.trim() || "Unnamed Page",
    page_text: form.page_text,
    page_url: form.page_url,
    widget_description: form.widget_description,
    ai_recursive: form.ai_recursive,
    keep_images: [...form.image_urls],
    new_images: [...form.new_images],
    ai_inference: {
      label: form.ai_inference_label,
      reason: form.ai_inference_reason
    }
  };
  try {
    await new Promise((resolve, reject) => {
      emit("save-page-review", { review, resolve, reject });
    });
    editorState.value = "view";
    saveMessage.value = "复核保存成功";
    createMessage.success({ content: "页面复核保存成功", key: "app-graph-save-review", duration: 2 });
  } catch (error) {
    editorState.value = "editing";
    saveMessage.value = error instanceof Error ? error.message : "复核保存失败";
    createMessage.error({ content: saveMessage.value, key: "app-graph-save-review", duration: 3 });
  }
}
</script>

<template>
  <aside class="inspector">
    <div class="panel-head">
      <div>
        <p class="eyebrow">Inspector</p>
        <h2>{{ detail?.title || "节点详情" }}</h2>
      </div>
      <div class="inspector-head-actions">
        <GraphButton
          v-if="detail?.mode === 'node'"
          class="inspector-edit-toggle"
          :type="editMode ? 'primary' : 'default'"
          html-type="button"
          @click="editMode ? cancelEdit() : beginEdit()"
        >
          <template #icon>
            <Icon :icon="saving ? 'ant-design:loading-outlined' : (editMode ? 'ant-design:close-outlined' : 'ant-design:edit-outlined')" :size="14" />
          </template>
          {{ saving ? "保存中" : (editMode ? "取消编辑" : "开启编辑") }}
        </GraphButton>
        <span class="panel-chip">AI</span>
      </div>
    </div>

    <ScrollArea v-if="detail" class="inspector-scroll">
      <div class="inspector-scroll-inner">
        <div class="summary">
          <div v-for="row in detail.rows" :key="row[0]" class="summary-row">
            <span>{{ row[0] }}</span>
            <strong>{{ row[1] }}</strong>
          </div>
        </div>

        <Card v-if="editMode && detail.mode === 'node'" class="review-editor">
          <CardHeader class="replay-card-head">
            <div class="ai-panel-head">
              <div>
                <p class="eyebrow">Review Mode</p>
                <CardTitle>页面复核编辑</CardTitle>
              </div>
              <Badge variant="secondary">Editable</Badge>
            </div>
          </CardHeader>
          <CardContent class="review-editor-content">
            <label>
              页面标题
              <input v-model="form.page_title" type="text" />
            </label>
            <label>
              页面 URL
              <input v-model="form.page_url" type="text" />
            </label>
            <label>
              父节点控件描述
              <input v-model="form.widget_description" type="text" />
            </label>
            <label>
              AI 页面描述
              <textarea v-model="form.page_text" rows="5" />
            </label>
            <div class="review-grid">
              <label>
                AI 推断标签
                <input v-model="form.ai_inference_label" type="text" />
              </label>
              <label class="review-check">
                <input v-model="form.ai_recursive" type="checkbox" />
                AI 推断生成页面
              </label>
            </div>
            <label>
              AI 推断理由
              <textarea v-model="form.ai_inference_reason" rows="4" />
            </label>
            <label>
              复核备注
              <textarea v-model="form.review_note" rows="3" placeholder="记录为什么修改，便于后端审计" />
            </label>

            <section class="image-editor">
              <div class="image-editor-head">
                <strong>截图证据</strong>
                <span>{{ form.image_urls.length }} 张</span>
              </div>
              <div class="image-add-row">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  @change="handleNewImages"
                />
              </div>
              <div v-if="form.new_images.length" class="pending-image-list">
                <div v-for="(file, index) in form.new_images" :key="`${file.name}-${file.size}`">
                  <span>{{ file.name }}</span>
                  <GraphButton danger @click="removeNewImage(index)">
                    <template #icon><Icon icon="ant-design:delete-outlined" :size="14" /></template>
                    移除
                  </GraphButton>
                </div>
              </div>
              <div v-if="form.image_urls.length" class="editable-image-list">
                <div v-for="(url, index) in form.image_urls" :key="url" class="editable-image-item">
                  <SmartImage
                    :candidates="[buildImageApiUrl(url)]"
                    :title="form.page_title"
                    :kind="index === 0 ? '主截图' : `证据图 ${index + 1}`"
                  />
                  <div>
                    <strong>{{ index === 0 ? "主截图" : `证据图 ${index + 1}` }}</strong>
                    <span>{{ url }}</span>
                  </div>
                  <GraphButton html-type="button" @click="removeImage(index)">
                    <template #icon><Icon icon="ant-design:delete-outlined" :size="14" /></template>
                    删除
                  </GraphButton>
                </div>
              </div>
            </section>

            <div class="review-actions">
              <GraphButton type="primary" html-type="button" :disabled="saving" @click="saveEdit">
                <template #icon><Icon :icon="saving ? 'ant-design:loading-outlined' : 'ant-design:save-outlined'" :size="14" /></template>
                {{ saving ? "保存中..." : "保存复核" }}
              </GraphButton>
              <GraphButton html-type="button" :disabled="saving" @click="cancelEdit">
                <template #icon><Icon icon="ant-design:close-outlined" :size="14" /></template>
                取消
              </GraphButton>
              <span v-if="saveMessage">{{ saveMessage }}</span>
            </div>
          </CardContent>
        </Card>

        <section v-if="detail.images.length" class="inspector-image-section">
          <div class="inspector-section-title">
            <strong>截图列表</strong>
            <span>{{ detail.images.length }} 张</span>
          </div>
          <div class="image-strip">
            <GraphButton
              v-for="image in detail.images"
              :key="`${image.rawUrl || image.title}-${image.kind}`"
              class="inspector-image-card"
              html-type="button"
              @click="openImagePreview(image)"
            >
              <span class="inspector-image-meta">
                <strong>{{ image.kind }}</strong>
                <em>点击全屏</em>
              </span>
              <SmartImage
                :candidates="image.candidates"
                :title="image.title"
                :kind="image.kind"
              />
              <span class="inspector-image-title">{{ image.rawUrl || image.title }}</span>
            </GraphButton>
          </div>
        </section>

        <Card v-if="detail.mode === 'node'" class="ai-panel">
          <CardHeader class="replay-card-head">
            <div class="ai-panel-head">
              <div>
                <p class="eyebrow">Page Model</p>
                <CardTitle>页面与动作分层</CardTitle>
              </div>
              <Badge variant="secondary">{{ detail.analysis.category.label }}</Badge>
            </div>
          </CardHeader>

          <CardContent class="replay-card-content">
            <p class="ai-summary">{{ payload.page_text || "暂无 page_text" }}</p>

            <section>
              <h4>AI 推理信息</h4>
              <div class="floating-inference">
                <strong>{{ payload.aiInference?.label || "暂无推断标签" }}</strong>
                <span>{{ payload.aiInference?.reason || "暂无推断理由" }}</span>
              </div>
            </section>

            <section>
              <h4>页面路径</h4>
              <div class="path-chain">
                <span v-for="item in detail.analysis.path" :key="item">{{ item }}</span>
              </div>
            </section>

            <section>
              <h4>上下游</h4>
              <div class="relation-lists">
                <div>
                  <span>上游</span>
                  <strong>{{ detail.analysis.upstream.join("、") || "-" }}</strong>
                </div>
                <div>
                  <span>下游</span>
                  <strong>{{ detail.analysis.downstream.join("、") || "-" }}</strong>
                </div>
              </div>
            </section>

            <section>
              <h4>动作分层</h4>
              <div class="action-layer-list">
                <div>
                  <strong>跳转控件</strong>
                  <span>形成 Page -> Page 边</span>
                  <em v-for="action in detail.analysis.navigationActions" :key="`${action.label}-${action.target}`">
                    {{ action.label }} -> {{ action.target }}
                  </em>
                  <em v-if="!detail.analysis.navigationActions.length">暂无</em>
                </div>
                <div>
                  <strong>状态动作</strong>
                  <span>不切页，只改变当前页面状态</span>
                  <em v-for="action in detail.analysis.stateActions" :key="action.id">
                    {{ action.label }} · {{ action.state_key }}
                  </em>
                  <em v-if="!detail.analysis.stateActions.length">暂无</em>
                </div>
                <div>
                  <strong>弹层动作</strong>
                  <span>打开弹层、半屏或局部面板</span>
                  <em v-for="action in detail.analysis.overlayActions" :key="action.id">
                    {{ action.label }}
                  </em>
                  <em v-if="!detail.analysis.overlayActions.length">暂无</em>
                </div>
                <div>
                  <strong>外部动作</strong>
                  <span>系统分享、相机、第三方 SDK 等</span>
                  <em v-for="action in detail.analysis.externalActions" :key="action.id">
                    {{ action.label }}
                  </em>
                  <em v-if="!detail.analysis.externalActions.length">暂无</em>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>

        <pre class="json-panel">{{ JSON.stringify(detail.json, null, 2) }}</pre>
      </div>
    </ScrollArea>

    <div v-else class="empty-state inspector-empty">请选择一个图谱节点</div>

    <Teleport to="body">
      <div v-if="previewImage" class="image-preview-overlay" @click="previewImage = null">
        <div class="image-preview-shell inspector-preview-shell" @click.stop>
          <GraphButton class="image-preview-close" icon-only html-type="button" aria-label="关闭预览" title="关闭预览" @click="previewImage = null">
            <Icon icon="ant-design:close-outlined" :size="16" />
          </GraphButton>
          <SmartImage
            class="image-preview-full"
            :candidates="previewImage.candidates"
            :title="previewImage.title"
            :kind="previewImage.kind"
          />
          <div class="image-preview-caption">
            <strong>{{ previewImage.title }}</strong>
            <span>{{ previewImage.kind }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </aside>
</template>

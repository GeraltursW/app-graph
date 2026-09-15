<script setup>
import { computed } from "vue";

const props = defineProps({
  type: { type: String, default: "default" },
  htmlType: { type: String, default: "button" },
  active: { type: Boolean, default: false },
  danger: { type: Boolean, default: false },
  iconOnly: { type: Boolean, default: false }
});

const tone = computed(() => {
  if (props.danger) return "danger";
  if (props.type === "primary" || props.active) return "primary";
  if (props.type === "text") return "text";
  return "default";
});
</script>

<template>
  <button
    :type="htmlType"
    class="graph-button"
    :class="[`tone-${tone}`, { 'icon-only': iconOnly }]"
  >
    <span v-if="$slots.icon" class="graph-button-icon"><slot name="icon" /></span>
    <span class="graph-button-label"><slot /></span>
  </button>
</template>

<style scoped>
.graph-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 27px;
  min-width: 0;
  padding: 0 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  color: #434343;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  transition: color .15s ease, border-color .15s ease, background .15s ease;
}
.graph-button:hover:not(:disabled) {
  border-color: #1677ff;
  color: #1677ff;
}
.graph-button:focus-visible {
  outline: 2px solid rgba(22, 119, 255, .22);
  outline-offset: 1px;
}
.graph-button:disabled {
  cursor: not-allowed;
  opacity: .45;
}
.tone-primary {
  border-color: #1677ff;
  background: #1677ff;
  color: #fff;
}
.tone-primary:hover:not(:disabled) {
  border-color: #4096ff;
  background: #4096ff;
  color: #fff;
}
.tone-text {
  border-color: transparent;
  background: transparent;
}
.tone-danger {
  border-color: #ffccc7;
  color: #cf1322;
}
.icon-only {
  width: 27px;
  padding: 0;
}
.graph-button-icon {
  font-size: 13px;
  line-height: 1;
}
.graph-button-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
defineProps<{ icon: string; size?: string | number }>();
</script>

<template><Icon :icon="icon" :width="size || 16" :height="size || 16" /></template>

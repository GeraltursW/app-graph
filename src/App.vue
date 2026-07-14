<script setup lang="ts">
import AppGraph from './views/app-graph/index.vue';
import PromoJourney from './views/app-graph/components/PromoJourney.vue';
</script>

<template>
  <main class="demo-page">
    <div class="demo-heading">
      <div>
        <span>Mobile Intelligence</span>
        <h1>Application Map</h1>
      </div>
      <PromoJourney />
    </div>
    <AppGraph />
  </main>
</template>

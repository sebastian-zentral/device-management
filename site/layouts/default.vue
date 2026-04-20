<script setup lang="ts">
const { data: nav } = await useAsyncData('nav', () => $fetch('/api/nav'))
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-white font-sans">
    <aside class="w-64 shrink-0 bg-ztl-navy overflow-hidden flex flex-col">
      <AppSidebar :nav="nav ?? []" />
    </aside>
    <main class="flex-1 overflow-y-auto bg-slate-50">
      <div class="px-8 py-8">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { data: nav } = await useAsyncData('nav', () => $fetch('/api/nav'))
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-white">
    <!-- Sidebar -->
    <aside class="w-64 shrink-0 border-r border-slate-200 bg-slate-50 overflow-hidden flex flex-col">
      <AppSidebar :nav="nav ?? []" />
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto">
      <div class="px-8 py-8">
        <slot />
      </div>
    </main>
  </div>
</template>

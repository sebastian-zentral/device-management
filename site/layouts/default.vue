<script setup lang="ts">
const { data: nav } = await useAsyncData('nav', () => apiFetch('/api/nav'))
const sidebarOpen = ref(false)
const route = useRoute()

watch(() => route.path, () => { sidebarOpen.value = false })
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-white font-sans">
    <!-- Mobile backdrop -->
    <Transition name="fade">
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-30 bg-black/40 md:hidden"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 w-64 shrink-0 bg-ztl-navy overflow-hidden flex flex-col transition-transform duration-300 ease-in-out md:static md:inset-auto md:z-auto md:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
    >
      <AppSidebar :nav="nav ?? []" />
    </aside>

    <!-- Main -->
    <main class="flex-1 overflow-y-auto bg-slate-50 min-w-0">
      <!-- Mobile header -->
      <div class="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 md:hidden">
        <button
          class="p-1.5 rounded-md text-ztl-anthracite hover:bg-slate-100 transition-colors"
          aria-label="Open menu"
          @click="sidebarOpen = true"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <span class="text-sm font-semibold text-ztl-anthracite">Device Management</span>
      </div>
      <div class="px-4 py-6 md:px-8 md:py-8">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

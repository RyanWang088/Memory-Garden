<script setup>
</script>

<template>
  <main class="container text-center py-5">
    <div style="width: 280px; height: 200px" class="mx-auto mb-4">
    </div>
    <h1>Sproutly</h1>
    <p>Study a little every day and watch your garden grow.</p>
    <RouterLink :to="{ name: 'auth' }" class="btn btn-success btn-lg" data-testid="start-growing">Start Growing</RouterLink>
  </main>
</template>

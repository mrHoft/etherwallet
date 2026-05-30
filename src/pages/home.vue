<template>
  <section class="page-home">
  <h1>Home page</h1>
  <img src="/frame.svg" alt="frame" class="frame"/>
  <ul>
    <li><a href="/create">Create wallet page</a></li>
    <li><a :href="randomRoute()">Random page</a></li>
  </ul>
  </section>
</template>

<script setup lang="ts">
const randomRoute=()=>{
  const sequence=Array.from({length: Math.trunc(Math.random()*3)+4},()=>String.fromCharCode(Math.trunc(Math.random()*25)+97))
  return `/${sequence.join('')}`
}
</script>

<style lang="css" scoped>
.page-home{
  justify-self: center;
  padding: 1.5rem;
}

.frame{
  filter: invert(var(--color-scheme));
}
</style>

<template>
  <div class="page-home">
    <h1>Home page</h1>
    <img src="/frame.svg" alt="frame" class="frame"/>
  </div>
</template>

<style scoped>
.page-home{
  justify-self: center;
  padding: 1.5rem;
}

.page-home h1{
  text-align: center;
}

.frame{
  filter: invert(var(--color-scheme));
}
</style>

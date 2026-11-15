<template>
  <div class="tip-page">
    <div class="tip-card">
      <h1 class="title">Tip Calculator</h1>

      <div class="field">
        <label class="label" for="bill">Bill amount</label>
        <input id="bill" v-model="bill" class="input" type="number" inputmode="decimal" min="0" step="0.01"
          placeholder="0.00" autocomplete="off" />
      </div>

      <div class="percentages">
        <button v-for="percentage in percentages" :key="percentage" type="button" class="percentage-button"
          :class="{ 'percentage-button--active': tipPercentage === percentage }" @click="selectPercentage(percentage)">
          {{ percentage }}%
        </button>
      </div>

      <div class="field">
        <label class="label" for="tip">Tip</label>
        <input id="tip" class="input" type="text" :value="tipAmount" readonly tabindex="-1" />
      </div>

      <div class="field">
        <label class="label" for="total">Total</label>
        <input id="total" class="input" type="text" :value="total" readonly tabindex="-1" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useNavigation } from '~/composables/useNavigation'

const UNLOCK_CODE = '256'

const percentages = [5, 10, 20]

const bill = ref('')
const tipPercentage = ref(10)

const { navigateTo } = useNavigation()

const tipAmount = computed<string>(() => {
  const amount = Number(bill.value)
  if (!Number.isFinite(amount) || amount <= 0) return '0.00'
  return ((amount * tipPercentage.value) / 100).toFixed(2)
})

const total = computed<string>(() => {
  const amount = Number(bill.value)
  if (!Number.isFinite(amount) || amount <= 0) return '0.00'
  return (amount + (amount * tipPercentage.value) / 100).toFixed(2)
})

const selectPercentage = (percentage: number): void => {
  tipPercentage.value = percentage
}

watch(bill, (value) => {
  if (String(value).trim() === UNLOCK_CODE) {
    navigateTo('/home')
  }
})
</script>

<style scoped>
.tip-page {
  min-height: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tip-card {
  width: 100%;
  max-width: 22rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  background: var(--color10);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 1rem;
  box-shadow: var(--shadow);
}

.title {
  margin: 0;
  font-family: var(--heading);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color90);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label {
  font-family: var(--heading);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color90);
}

.input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.625rem 0.75rem;
  font-family: var(--sans);
  font-size: 1rem;
  color: var(--color90);
  background-color: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.375rem;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.input:hover {
  border-color: var(--color60);
}

.input:focus {
  border-color: var(--color-accent60);
  background-color: var(--color30);
}

.input[readonly] {
  color: var(--color80);
  cursor: default;
}

.percentages {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.percentage-button {
  padding: 0.625rem 0.5rem;
  font-family: var(--sans);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color80);
  background-color: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.percentage-button:hover {
  color: var(--color90);
  background-color: var(--color30);
  border-color: var(--color60);
}

.percentage-button--active {
  color: white;
  background-color: var(--color-accent60);
  border-color: var(--color-accent60);
}
</style>

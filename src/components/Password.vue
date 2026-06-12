<template>
  <div class="password-component" @click="focusInput">
    <div class="password-boxes">
      <div v-for="(char, index) in displayedChars" :key="index" ref="charBoxRefs"
        :class="['char-box', { focused: focusedIndex === index }]" @click.stop="setFocusAtIndex(index)">
        {{ char }}
      </div>
    </div>

    <input ref="inputRef" type="text" :maxlength="maxLength" :value="inputValue" class="hidden-input"
      @input="handleInput" @keydown="handleKeydown" @focus="handleFocus" @blur="handleBlur" />

    <button type="button" class="visibility-toggle" @click.stop="toggleVisibility"
      :aria-label="isVisible ? 'Hide password' : 'Show password'">
      <svg v-if="isVisible" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
        fill="currentColor">
        <path
          d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Props {
  maxLength?: number
  modelValue?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'complete', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  maxLength: 6,
  modelValue: ''
})

const emit = defineEmits<Emits>()

const inputRef = ref<HTMLInputElement | null>(null)
const inputValue = ref<string>(props.modelValue)
const focusedIndex = ref<number>(-1)
const isVisible = ref<boolean>(false)

const displayedChars = computed(() => {
  const chars = inputValue.value.split('')
  const result: string[] = []

  for (let i = 0; i < props.maxLength; i++) {
    if (i < chars.length) {
      result.push(isVisible.value ? chars[i] : '•')
    } else {
      result.push('')
    }
  }

  return result
})

const focusInput = () => {
  if (inputRef.value) {
    inputRef.value.focus()
  }
}

const setFocusAtIndex = (index: number) => {
  focusedIndex.value = index
  focusInput()
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  let newValue = target.value

  if (newValue.length > props.maxLength) {
    newValue = newValue.slice(0, props.maxLength)
  }

  inputValue.value = newValue
  emit('update:modelValue', newValue)

  if (newValue.length === props.maxLength) {
    emit('complete', newValue)
  }

  updateFocusIndex()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Backspace' && inputValue.value.length === 0) {
    focusedIndex.value = 0
  }
}

const handleFocus = () => {
  updateFocusIndex()
}

const handleBlur = () => {
  focusedIndex.value = -1
}

const updateFocusIndex = () => {
  const length = inputValue.value.length
  if (length < props.maxLength) {
    focusedIndex.value = length
  } else {
    focusedIndex.value = props.maxLength - 1
  }
}

const toggleVisibility = () => {
  isVisible.value = !isVisible.value
}

const clear = () => {
  inputValue.value = ''
  emit('update:modelValue', '')
  focusedIndex.value = -1
  if (inputRef.value) inputRef.value.value = ''
}

defineExpose({ clear, focusInput })

onMounted(() => {
  if (inputValue.value.length > 0) {
    updateFocusIndex()
  }
})

onUnmounted(() => {
  focusedIndex.value = -1
})
</script>

<style scoped>
.password-component {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  cursor: pointer;
}

.password-boxes {
  display: flex;
  gap: 0.5rem;
}

.char-box {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 500;
  background-color: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  font-family: monospace;
  cursor: pointer;
  color: var(--color90);
}

.char-box.focused {
  border-color: var(--color-accent60);
  background-color: var(--color10);
}

.hidden-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
  margin: 0;
  padding: 0;
  border: none;
}

.visibility-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  color: var(--color60);
  flex-shrink: 0;
}

.visibility-toggle:hover {
  background-color: var(--color30);
  color: var(--color80);
}
</style>

<template>
  <SettingsSection title="Theme" description="Choose how app looks. System follows your device appearance.">
    <div class="theme-options" role="group" aria-label="Theme">
      <button type="button" :class="['theme-option', { 'theme-option--active': themePreference === 'light' }]"
        :aria-pressed="themePreference === 'light'" @click="setThemePreference('light')">
        <span class="theme-option__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke-width="1.5">
            <circle fill="currentColor" cx="12" cy="12" r="5" />
            <path stroke="currentColor"
              d="M12 2V6M12 18V22M18 12H22M2 12H6M5 5L7.8 7.8M16.2 16.2L19 19M16.2 7.8L19 5M5 19L7.8 16.2" />
          </svg>
        </span>
        <span>Light</span>
      </button>

      <button type="button" :class="['theme-option', { 'theme-option--active': themePreference === 'dark' }]"
        :aria-pressed="themePreference === 'dark'" @click="setThemePreference('dark')">
        <span class="theme-option__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="m21.96,16.11c-1.69,3.75-5.4,5.89-9.44,5.89-5.8,0-10.52-4.72-10.52-10.53,0-4.02,2.41-7.92,5.84-9.43.43-.19.72.22.57.56-.63,1.36-.99,2.77-.99,4.27,0,5.34,4.34,9.69,9.67,9.69,1.51,0,3.03-.3,4.31-1.01.46-.26.79.07.56.56Z" />
          </svg>
        </span>
        <span>Dark</span>
      </button>

      <button type="button" :class="['theme-option', { 'theme-option--active': themePreference === 'system' }]"
        :aria-pressed="themePreference === 'system'" @click="setThemePreference('system')">
        <span class="theme-option__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M8 21H16M12 17V21" />
          </svg>
        </span>
        <span>System</span>
      </button>
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import SettingsSection from '~/components/settings/SettingsSection.vue'
import { useTheme } from '~/composables/useTheme'

const { preference: themePreference, setPreference: setThemePreference } = useTheme()
</script>

<style scoped>
.theme-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 4.25rem;
  padding: 0.5rem;
  background-color: var(--color20);
  border: var(--border-thickness) solid var(--color40);
  border-radius: 0.5rem;
  color: var(--color70);
  font-family: var(--sans);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.theme-option:hover {
  background-color: var(--color30);
  color: var(--color90);
}

.theme-option:focus-visible {
  outline: var(--border-thickness) solid var(--color-accent60);
  outline-offset: 2px;
}

.theme-option--active {
  background-color: var(--color30);
  border-color: var(--color-accent60);
  color: var(--color90);
}

.theme-option--active .theme-option__icon {
  color: var(--color-accent80);
}

.theme-option__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.theme-option__icon svg {
  width: 1.5rem;
  height: 1.5rem;
}
</style>

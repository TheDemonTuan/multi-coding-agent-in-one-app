<script lang="ts">
  interface Props {
    id?: string;
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    class?: string;
  }

  let {
    id,
    label,
    value = $bindable(),
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    class: className = ''
  }: Props = $props();

  function decrement() {
    if (value - step >= min) {
      value -= step;
    } else {
      value = min;
    }
  }

  function increment() {
    if (value + step <= max) {
      value += step;
    } else {
      value = max;
    }
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = Number(target.value);
    if (!isNaN(newValue)) {
      value = Math.min(Math.max(newValue, min), max);
    }
  }
</script>

<div class="stepper-input-wrapper {className}">
  {#if label}
    <label class="stepper-label" for={id}>{label}</label>
  {/if}
  <div class="stepper-control">
    <button
      type="button"
      class="stepper-btn"
      onclick={decrement}
      disabled={disabled || value <= min}
      aria-label="Decrease value"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
    <input
      type="number"
      id={id}
      class="stepper-value"
      bind:value
      {min}
      {max}
      {step}
      {disabled}
      oninput={handleInput}
    />
    <button
      type="button"
      class="stepper-btn"
      onclick={increment}
      disabled={disabled || value >= max}
      aria-label="Increase value"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</div>

<style>
  .stepper-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .stepper-label {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-subtext0);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stepper-control {
    display: flex;
    align-items: center;
    background: var(--color-bg-surface0);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .stepper-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-surface1);
    border: none;
    color: var(--color-text);
    font-size: 18px;
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .stepper-btn:hover:not(:disabled) {
    background: var(--color-bg-surface2);
  }

  .stepper-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .stepper-value {
    flex: 1;
    text-align: center;
    background: transparent;
    border: none;
    color: var(--color-text);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    padding: var(--space-2);
    min-width: 50px;
    /* Hide default number spinner */
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .stepper-value::-webkit-outer-spin-button,
  .stepper-value::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .stepper-value:focus {
    outline: none;
  }

  .stepper-control:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(137, 180, 250, 0.1);
  }
</style>

<script lang="ts">
  interface Props {
    id?: string;
    label: string;
    value?: string;
    placeholder?: string;
    type?: 'text' | 'number' | 'email' | 'password';
    required?: boolean;
    disabled?: boolean;
    error?: string;
    class?: string;
  }

  let {
    id,
    label,
    value = $bindable(''),
    placeholder = ' ',
    type = 'text',
    required = false,
    disabled = false,
    error,
    class: className = ''
  }: Props = $props();
</script>

<div class="floating-input-wrapper {className}">
  <input
    {id}
    {type}
    {required}
    {disabled}
    bind:value
    class="floating-input"
    class:error={!!error}
    {placeholder}
  />
  <label for={id} class="floating-label">{label}</label>
  {#if error}
    <span class="error-text">{error}</span>
  {/if}
</div>

<style>
  .floating-input-wrapper {
    position: relative;
    width: 100%;
  }

  .floating-input {
    width: 100%;
    padding: var(--space-3) var(--space-3);
    padding-top: calc(var(--space-3) + 8px);
    background: var(--color-bg-surface0);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-size: var(--text-base);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }

  .floating-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(137, 180, 250, 0.1);
    outline: none;
  }

  .floating-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .floating-input.error {
    border-color: var(--color-error);
  }

  .floating-input.error:focus {
    box-shadow: 0 0 0 3px rgba(243, 139, 168, 0.1);
  }

  .floating-label {
    position: absolute;
    left: var(--space-3);
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-overlay0);
    font-size: var(--text-base);
    pointer-events: none;
    transition: all var(--transition-fast) var(--ease-out);
    transform-origin: left top;
  }

  .floating-input:focus ~ .floating-label,
  .floating-input:not(:placeholder-shown) ~ .floating-label {
    top: 8px;
    transform: translateY(0) scale(0.85);
    color: var(--color-primary);
  }

  .floating-input.error:focus ~ .floating-label,
  .floating-input.error:not(:placeholder-shown) ~ .floating-label {
    color: var(--color-error);
  }

  .error-text {
    color: var(--color-error);
    font-size: var(--text-xs);
    margin-top: var(--space-1);
    display: block;
  }
</style>
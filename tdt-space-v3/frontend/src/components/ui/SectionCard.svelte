<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    children: Snippet;
    class?: string;
    delay?: number;
  }

  let {
    title,
    children,
    class: className = '',
    delay = 0
  }: Props = $props();
</script>

<div
  class="section-card {className}"
  style="--enter-delay: {delay}ms"
>
  <div class="section-header">
    {title}
  </div>
  <div class="section-content">
    {@render children()}
  </div>
</div>

<style>
  .section-card {
    background: var(--color-bg-mantle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    animation: sectionEnter 300ms var(--ease-spring) forwards;
    animation-delay: var(--enter-delay, 0ms);
    opacity: 0;
    transition: box-shadow var(--transition-normal) var(--ease-default);
  }

  .section-card:hover {
    box-shadow: var(--shadow-sm);
  }

  .section-header {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-subtext0);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-4);
  }

  .section-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  @keyframes sectionEnter {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>

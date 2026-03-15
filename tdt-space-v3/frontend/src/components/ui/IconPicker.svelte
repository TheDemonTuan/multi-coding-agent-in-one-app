<script lang="ts">
  interface Props {
    value: string;
    options: string[];
    onSelect: (emoji: string) => void;
    class?: string;
  }

  let { value, options, onSelect, class: className = '' }: Props = $props();

  let isOpen = $state(false);
  let searchQuery = $state('');
  let activeCategory = $state('work');

  const categories = [
    { id: 'recent', label: 'Recent', emojis: [] },
    { id: 'work', label: 'Work', emojis: ['📁', '📂', '💼', '🗂️', '📊', '📈', '💻', '⚡'] },
    { id: 'nature', label: 'Nature', emojis: ['🔥', '🚀', '⭐', '🔷', '🔶', '💎', '🎨', '🌐'] },
    { id: 'objects', label: 'Objects', emojis: ['🏗️', '🏢', '🔧', '🎯', '🎪', '🎬', '🎮', '🎲'] },
  ];

  // Filter emojis based on search and category
  let filteredEmojis = $derived.by(() => {
    const category = categories.find(c => c.id === activeCategory);
    if (!category) return [];
    
    if (searchQuery) {
      // Search across all categories
      return categories
        .flatMap(c => c.emojis)
        .filter(e => e.includes(searchQuery) || searchQuery.toLowerCase().includes(e));
    }
    
    return category.emojis;
  });

  function toggleDropdown() {
    isOpen = !isOpen;
    if (!isOpen) {
      searchQuery = '';
    }
  }

  function handleSelect(emoji: string) {
    onSelect(emoji);
    isOpen = false;
    searchQuery = '';
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
      searchQuery = '';
    }
  }

  // Close on click outside
  $effect(() => {
    if (isOpen) {
      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.icon-picker')) {
          isOpen = false;
          searchQuery = '';
        }
      };
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  });
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="icon-picker {className}">
  <button
    type="button"
    class="icon-picker-trigger"
    class:active={isOpen}
    onclick={toggleDropdown}
    aria-expanded={isOpen}
    aria-haspopup="listbox"
  >
    <span class="current-icon">{value || '📁'}</span>
    <span class="dropdown-arrow">▼</span>
  </button>

  {#if isOpen}
    <div 
      class="icon-picker-dropdown"
      role="listbox"
      aria-label="Select icon"
    >
      <input
        type="text"
        class="icon-search"
        placeholder="Search icons..."
        bind:value={searchQuery}
      />

      <div class="icon-categories" role="tablist">
        {#each categories as category}
          <button
            type="button"
            class="category-tab"
            class:active={activeCategory === category.id}
            onclick={() => activeCategory = category.id}
            role="tab"
            aria-selected={activeCategory === category.id}
          >
            {category.label}
          </button>
        {/each}
      </div>

      <div class="icon-grid" role="listbox">
        {#each filteredEmojis as emoji}
          <button
            type="button"
            class="icon-option"
            class:selected={value === emoji}
            onclick={() => handleSelect(emoji)}
            role="option"
            aria-selected={value === emoji}
          >
            {emoji}
            {#if value === emoji}
              <span class="checkmark">✓</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .icon-picker {
    position: relative;
  }

  .icon-picker-trigger {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-surface0);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .icon-picker-trigger:hover {
    border-color: var(--color-border-hover);
    background: var(--color-bg-surface1);
  }

  .icon-picker-trigger.active {
    border-color: var(--color-primary);
  }

  .current-icon {
    font-size: 20px;
  }

  .dropdown-arrow {
    font-size: 10px;
    color: var(--color-text-subtext0);
    transition: transform var(--transition-fast);
  }

  .icon-picker-trigger.active .dropdown-arrow {
    transform: rotate(180deg);
  }

  .icon-picker-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    width: 320px;
    background: var(--color-bg-mantle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-3);
    box-shadow: var(--shadow-lg);
    z-index: var(--z-dropdown);
    animation: dropdownIn 150ms var(--ease-out);
  }

  @keyframes dropdownIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .icon-search {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-surface0);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-size: var(--text-sm);
    margin-bottom: var(--space-3);
  }

  .icon-search:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .icon-categories {
    display: flex;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--space-2);
  }

  .category-tab {
    padding: var(--space-1) var(--space-2);
    background: transparent;
    border: none;
    color: var(--color-text-subtext0);
    font-size: var(--text-xs);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .category-tab:hover {
    color: var(--color-text);
    background: var(--color-bg-surface0);
  }

  .category-tab.active {
    color: var(--color-primary);
    background: rgba(137, 180, 250, 0.1);
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: var(--space-1);
    max-height: 200px;
    overflow-y: auto;
  }

  .icon-option {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    background: var(--color-bg-surface0);
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
  }

  .icon-option:hover {
    background: var(--color-bg-surface1);
    border-color: var(--color-border-hover);
  }

  .icon-option.selected {
    background: rgba(137, 180, 250, 0.15);
    border-color: var(--color-primary);
  }

  .icon-option .checkmark {
    position: absolute;
    bottom: 2px;
    right: 2px;
    font-size: 10px;
    color: var(--color-primary);
  }
</style>

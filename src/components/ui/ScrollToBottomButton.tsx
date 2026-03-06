import React from 'react';

interface ScrollToBottomButtonProps {
  isVisible: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  isVisible,
  onClick,
  unreadCount = 0,
}) => {
  if (!isVisible) return null;

  return (
    <button
      onClick={onClick}
      style={{
        ...styles.button,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
      title="Scroll to bottom"
    >
      <span style={styles.icon}>↓</span>
      <span style={styles.label}>Scroll to bottom</span>
      {unreadCount > 0 && (
        <span style={styles.badge}>{unreadCount}</span>
      )}
    </button>
  );
};

const styles: Record<string, React.CSSProperties> = {
  button: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#89b4fa',
    color: '#1e1e2e',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(137, 180, 250, 0.4)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 50,
  },
  icon: {
    fontSize: '16px',
    fontWeight: 600,
    animation: 'bounce 1s infinite',
  },
  label: {
    whiteSpace: 'nowrap',
  },
  badge: {
    backgroundColor: '#f38ba8',
    color: '#1e1e2e',
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: '10px',
    minWidth: '20px',
    textAlign: 'center',
  },
};

// Add keyframes for bounce animation
const styleElement = document.createElement('style');
styleElement.textContent = `
  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-3px);
    }
  }
`;
if (typeof document !== 'undefined' && !document.getElementById('scroll-button-styles')) {
  styleElement.id = 'scroll-button-styles';
  document.head.appendChild(styleElement);
}

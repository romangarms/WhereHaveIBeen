/**
 * Reusable Button component with Tailwind styling
 */

const variantStyles = {
  primary: 'px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 active:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors font-medium text-sm',
  secondary: 'px-4 py-2 bg-white text-neutral-700 border border-neutral-300 rounded-md hover:bg-neutral-50 active:bg-neutral-100 transition-colors font-medium text-sm',
  danger: 'px-4 py-2 bg-secondary-500 text-white rounded-md hover:bg-secondary-600 active:bg-red-700 transition-colors font-medium text-sm',
  success: 'px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 active:bg-green-700 transition-colors font-medium text-sm',
  warning: 'px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 active:bg-yellow-700 transition-colors font-medium text-sm',
};

export default function Button({
  children,
  variant = 'primary',
  onClick,
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

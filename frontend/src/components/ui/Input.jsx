/**
 * Reusable Input component with Tailwind styling
 */

export default function Input({
  type = 'text',
  value,
  onChange,
  placeholder = '',
  disabled = false,
  required = false,
  className = '',
  ...props
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={`w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm ${className}`}
      {...props}
    />
  );
}

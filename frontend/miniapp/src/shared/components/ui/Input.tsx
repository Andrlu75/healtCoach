import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full h-11 px-3 rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100',
            'placeholder:text-gray-400 dark:placeholder:text-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'transition-colors',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-200 dark:border-gray-700',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-red-500">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

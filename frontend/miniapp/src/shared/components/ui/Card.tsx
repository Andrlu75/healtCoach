import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const baseStyles = 'rounded-2xl bg-white dark:bg-gray-900'

    const variants = {
      default: 'border border-gray-100 dark:border-gray-800',
      elevated: 'shadow-sm',
    }

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 pt-4 pb-2', className)} {...props} />
  )
)

CardHeader.displayName = 'CardHeader'

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 pb-4', className)} {...props} />
  )
)

CardContent.displayName = 'CardContent'

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-sm font-semibold text-gray-900 dark:text-gray-100', className)} {...props} />
  )
)

CardTitle.displayName = 'CardTitle'

/**
 * Тесты для компонента DraggableDishesPanel.
 * Базовые тесты для проверки рендеринга.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DishDragOverlay } from '../DraggableDishesPanel'
import type { DishListItem } from '@/types/dishes'

const mockDish: DishListItem = {
  id: 1,
  name: 'Овсяная каша',
  calories: 350,
  proteins: 12,
  fats: 8,
  carbohydrates: 55,
  portion_weight: 300,
  cooking_time: 15,
  photo: null,
  thumbnail: null,
  tags: [],
  meal_types: ['breakfast'],
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
}

describe('DishDragOverlay', () => {
  it('renders dish name', () => {
    render(<DishDragOverlay dish={mockDish} />)
    expect(screen.getByText('Овсяная каша')).toBeInTheDocument()
  })

  it('renders nutrition info', () => {
    render(<DishDragOverlay dish={mockDish} />)
    expect(screen.getByText(/350.*ккал/i)).toBeInTheDocument()
  })

  it('renders with photo', () => {
    const dishWithPhoto = { ...mockDish, photo: 'https://example.com/photo.jpg' }
    render(<DishDragOverlay dish={dishWithPhoto} />)
    const img = screen.getByAltText('Овсяная каша')
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
  })

  it('renders placeholder without photo', () => {
    render(<DishDragOverlay dish={mockDish} />)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})

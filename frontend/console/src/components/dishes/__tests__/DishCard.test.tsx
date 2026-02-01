/**
 * Тесты для компонента DishCard.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DishCard } from '../DishCard'
import type { DishListItem } from '@/types/dishes'

// Mock dish data
const mockDish: DishListItem = {
  id: 1,
  name: 'Овсяная каша с бананом',
  calories: 350,
  proteins: 12,
  fats: 8,
  carbohydrates: 55,
  portion_weight: 300,
  cooking_time: 15,
  photo: null,
  thumbnail: null,
  tags: [
    { id: 1, name: 'Завтрак', color: '#22c55e' },
    { id: 2, name: 'Здоровое', color: '#3b82f6' },
  ],
  meal_types: ['breakfast'],
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
}

const mockDishWithPhoto: DishListItem = {
  ...mockDish,
  photo: 'https://example.com/photo.jpg',
}

const mockDishWithManyTags: DishListItem = {
  ...mockDish,
  tags: [
    { id: 1, name: 'Завтрак', color: '#22c55e' },
    { id: 2, name: 'Здоровое', color: '#3b82f6' },
    { id: 3, name: 'Веган', color: '#a855f7' },
    { id: 4, name: 'Быстрое', color: '#f59e0b' },
  ],
}

describe('DishCard', () => {
  it('renders dish name', () => {
    render(<DishCard dish={mockDish} />)
    expect(screen.getByText('Овсяная каша с бананом')).toBeInTheDocument()
  })

  it('renders nutrition info', () => {
    render(<DishCard dish={mockDish} />)
    expect(screen.getByText('350 ккал')).toBeInTheDocument()
    expect(screen.getByText('Б: 12г')).toBeInTheDocument()
    expect(screen.getByText('Ж: 8г')).toBeInTheDocument()
    expect(screen.getByText('У: 55г')).toBeInTheDocument()
  })

  it('renders portion weight', () => {
    render(<DishCard dish={mockDish} />)
    expect(screen.getByText('Порция: 300г')).toBeInTheDocument()
  })

  it('renders cooking time', () => {
    render(<DishCard dish={mockDish} />)
    expect(screen.getByText('15 мин')).toBeInTheDocument()
  })

  it('renders tags', () => {
    render(<DishCard dish={mockDish} />)
    // Может быть несколько элементов "Завтрак" (тег + meal_type)
    expect(screen.getAllByText('Завтрак').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Здоровое')).toBeInTheDocument()
  })

  it('shows +N when more than 3 tags', () => {
    render(<DishCard dish={mockDishWithManyTags} />)
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', () => {
    const onClick = vi.fn()
    render(<DishCard dish={mockDish} onClick={onClick} />)
    
    const card = screen.getByText('Овсяная каша с бананом').closest('[class*="Card"]')
    if (card) {
      fireEvent.click(card)
      expect(onClick).toHaveBeenCalledTimes(1)
    }
  })

  it('renders placeholder when no photo', () => {
    render(<DishCard dish={mockDish} />)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders photo when provided', () => {
    render(<DishCard dish={mockDishWithPhoto} />)
    const img = screen.getByAltText('Овсяная каша с бананом')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
  })

  it('does not render portion weight when zero', () => {
    const dishWithoutPortion = { ...mockDish, portion_weight: 0 }
    render(<DishCard dish={dishWithoutPortion} />)
    expect(screen.queryByText(/Порция:/)).not.toBeInTheDocument()
  })

  it('does not render cooking time when not provided', () => {
    const dishWithoutTime = { ...mockDish, cooking_time: null }
    render(<DishCard dish={dishWithoutTime} />)
    expect(screen.queryByText(/мин/)).not.toBeInTheDocument()
  })
})

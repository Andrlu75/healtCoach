/**
 * Тесты для компонента DishSelector.
 * Базовые тесты рендеринга.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DishSelector } from '../DishSelector'
import { dishesApi } from '@/api/dishes'
import { BrowserRouter } from 'react-router-dom'

// Mock API
vi.mock('@/api/dishes', () => ({
  dishesApi: {
    list: vi.fn(),
  },
}))

const mockDishes = [
  {
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
  },
  {
    id: 2,
    name: 'Греческий салат',
    calories: 200,
    proteins: 8,
    fats: 15,
    carbohydrates: 10,
    portion_weight: 250,
    cooking_time: 10,
    photo: null,
    thumbnail: null,
    tags: [],
    meal_types: ['lunch', 'dinner'],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
]

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('DishSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dishesApi.list).mockResolvedValue({ results: mockDishes, count: 2 })
  })

  it('does not render dialog when closed', () => {
    renderWithRouter(
      <DishSelector isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.queryByText('Выбрать блюдо из базы')).not.toBeInTheDocument()
  })

  it('loads dishes when opened', async () => {
    renderWithRouter(
      <DishSelector isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    )

    await waitFor(() => {
      expect(dishesApi.list).toHaveBeenCalled()
    })
  })

  it('displays dishes after loading', async () => {
    renderWithRouter(
      <DishSelector isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('Овсяная каша')).toBeInTheDocument()
      expect(screen.getByText('Греческий салат')).toBeInTheDocument()
    })
  })

  it('calls onSelect when dish card is clicked', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderWithRouter(
      <DishSelector isOpen={true} onClose={onClose} onSelect={onSelect} />
    )

    await waitFor(() => {
      expect(screen.getByText('Овсяная каша')).toBeInTheDocument()
    })

    // Клик по карточке блюда (button элемент)
    const dishCard = screen.getByText('Овсяная каша').closest('button')
    if (dishCard) {
      await user.click(dishCard)
    }

    expect(onSelect).toHaveBeenCalledWith(mockDishes[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('shows empty state when no dishes', async () => {
    vi.mocked(dishesApi.list).mockResolvedValue({ results: [], count: 0 })

    renderWithRouter(
      <DishSelector isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('В базе пока нет блюд')).toBeInTheDocument()
    })
  })
})

/**
 * Тесты для страницы DishForm.
 * Базовые тесты рендеринга.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DishForm from '../DishForm'

// Mock stores
vi.mock('@/stores/dishes', () => ({
  useDishesStore: () => ({
    tags: [
      { id: 1, name: 'Завтрак', color: '#22c55e' },
      { id: 2, name: 'Обед', color: '#3b82f6' },
    ],
    selectedDish: null,
    isLoading: false,
    error: null,
    fetchTags: vi.fn(),
    fetchDish: vi.fn(),
    createDish: vi.fn().mockResolvedValue({ id: 1 }),
    updateDish: vi.fn().mockResolvedValue({ id: 1 }),
    setSelectedDish: vi.fn(),
    clearError: vi.fn(),
  }),
}))

// Mock API
vi.mock('@/api/dishes', () => ({
  dishesAiApi: {
    generateRecipe: vi.fn(),
    calculateNutrition: vi.fn(),
    suggestDescription: vi.fn(),
  },
}))

const renderDishForm = (route = '/dishes/new') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/dishes/new" element={<DishForm />} />
        <Route path="/dishes/:id" element={<DishForm />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('DishForm', () => {
  it('renders form title for new dish', async () => {
    renderDishForm('/dishes/new')

    await waitFor(() => {
      expect(screen.getByText(/новое блюдо/i)).toBeInTheDocument()
    })
  })

  it('renders save button', async () => {
    renderDishForm()

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /сохранить/i })
      expect(saveButton).toBeInTheDocument()
    })
  })

  it('renders tags section', async () => {
    renderDishForm()

    await waitFor(() => {
      // CardTitle "Теги" должен отображаться
      expect(screen.getByText('Теги')).toBeInTheDocument()
    })
  })

  it('renders meal type section', async () => {
    renderDishForm()

    await waitFor(() => {
      expect(screen.getByText('Подходит для')).toBeInTheDocument()
    })
  })
})

/**
 * Страница создания/редактирования блюда.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, ImagePlus, X, Plus, Trash2, Sparkles } from 'lucide-react'
import { useDishesStore } from '@/stores/dishes'
import { dishesAiApi } from '@/api/dishes'
import { MEAL_TYPE_LABELS, PRODUCT_CATEGORY_LABELS, type MealType, type Ingredient } from '@/types/dishes'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { ShoppingLinksInput } from '@/components/dishes/ShoppingLinksInput'

// Тип данных для предзаполнения из программы питания
interface PrefillData {
  name?: string
  description?: string
  meal_type?: MealType
}

export default function DishForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isEditing = !!id

  // Данные для предзаполнения из программы питания (location.state)
  const prefillData = location.state as PrefillData | undefined

  const {
    selectedDish,
    tags,
    isLoading,
    fetchDish,
    fetchTags,
    createDish,
    updateDish,
  } = useDishesStore()

  // Состояние формы
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    recipe: '',
    portion_weight: 0,
    calories: 0,
    proteins: 0,
    fats: 0,
    carbohydrates: 0,
    cooking_time: null as number | null,
    video_url: '',
    meal_types: [] as MealType[],
    tag_ids: [] as number[],
    ingredients: [] as Ingredient[],
    shopping_links: [] as { title: string; url: string }[],
  })

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // AI loading состояния
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false)
  const [isCalculatingNutrition, setIsCalculatingNutrition] = useState(false)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)

  const { toast } = useToast()

  // Загрузка данных
  useEffect(() => {
    fetchTags()
    if (isEditing && id) {
      fetchDish(parseInt(id, 10))
    }
  }, [id, isEditing, fetchDish, fetchTags])

  // Предзаполнение формы из программы питания (только для нового блюда)
  useEffect(() => {
    if (!isEditing && prefillData) {
      setFormData((prev) => ({
        ...prev,
        name: prefillData.name || prev.name,
        description: prefillData.description || prev.description,
        meal_types: prefillData.meal_type ? [prefillData.meal_type] : prev.meal_types,
      }))
    }
  }, [isEditing, prefillData])

  // Заполнение формы при редактировании
  useEffect(() => {
    if (isEditing && selectedDish) {
      setFormData({
        name: selectedDish.name,
        description: selectedDish.description,
        recipe: selectedDish.recipe,
        portion_weight: selectedDish.portion_weight,
        calories: selectedDish.calories,
        proteins: selectedDish.proteins,
        fats: selectedDish.fats,
        carbohydrates: selectedDish.carbohydrates,
        cooking_time: selectedDish.cooking_time,
        video_url: selectedDish.video_url,
        meal_types: selectedDish.meal_types,
        tag_ids: selectedDish.tags.map((t) => t.id),
        ingredients: selectedDish.ingredients,
        shopping_links: selectedDish.shopping_links,
      })
      if (selectedDish.photo) {
        setPhotoPreview(selectedDish.photo)
      }
    }
  }, [isEditing, selectedDish])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseFloat(value) : 0) : value,
    }))
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const handleMealTypeToggle = (mealType: MealType) => {
    setFormData((prev) => ({
      ...prev,
      meal_types: prev.meal_types.includes(mealType)
        ? prev.meal_types.filter((mt) => mt !== mealType)
        : [...prev.meal_types, mealType],
    }))
  }

  const handleTagToggle = (tagId: number) => {
    setFormData((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((id) => id !== tagId)
        : [...prev.tag_ids, tagId],
    }))
  }

  const handleAddIngredient = () => {
    setFormData((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { name: '', weight: 0, calories: 0, proteins: 0, fats: 0, carbohydrates: 0 },
      ],
    }))
  }

  const handleRemoveIngredient = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }))
  }

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      ),
    }))
  }

  const handleRecalculateNutrition = () => {
    const totals = formData.ingredients.reduce(
      (acc, ing) => ({
        weight: acc.weight + (ing.weight || 0),
        calories: acc.calories + (ing.calories || 0),
        proteins: acc.proteins + (ing.proteins || 0),
        fats: acc.fats + (ing.fats || 0),
        carbohydrates: acc.carbohydrates + (ing.carbohydrates || 0),
      }),
      { weight: 0, calories: 0, proteins: 0, fats: 0, carbohydrates: 0 }
    )

    setFormData((prev) => ({
      ...prev,
      portion_weight: Math.round(totals.weight),
      calories: Math.round(totals.calories * 100) / 100,
      proteins: Math.round(totals.proteins * 100) / 100,
      fats: Math.round(totals.fats * 100) / 100,
      carbohydrates: Math.round(totals.carbohydrates * 100) / 100,
    }))
  }

  // ========== AI HANDLERS ==========

  const handleGenerateRecipe = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Введите название',
        description: 'Для генерации рецепта нужно указать название блюда',
        variant: 'destructive',
      })
      return
    }

    setIsGeneratingRecipe(true)
    try {
      const recipe = await dishesAiApi.generateRecipe(formData.name)

      setFormData((prev) => ({
        ...prev,
        recipe: recipe.recipe,
        portion_weight: recipe.portion_weight,
        cooking_time: recipe.cooking_time,
        calories: recipe.calories,
        proteins: recipe.proteins,
        fats: recipe.fats,
        carbohydrates: recipe.carbohydrates,
        ingredients: recipe.ingredients.map((ing) => ({
          name: ing.name,
          weight: ing.weight,
          calories: ing.calories,
          proteins: ing.proteins,
          fats: ing.fats,
          carbohydrates: ing.carbohydrates,
        })),
      }))

      toast({
        title: 'Рецепт сгенерирован',
        description: `Добавлено ${recipe.ingredients.length} ингредиентов`,
      })
    } catch (error) {
      console.error('Error generating recipe:', error)
      toast({
        title: 'Ошибка',
        description: 'Не удалось сгенерировать рецепт. Попробуйте позже.',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingRecipe(false)
    }
  }

  const handleAiCalculateNutrition = async () => {
    if (formData.ingredients.length === 0) {
      toast({
        title: 'Нет ингредиентов',
        description: 'Добавьте ингредиенты для расчёта КБЖУ',
        variant: 'destructive',
      })
      return
    }

    setIsCalculatingNutrition(true)
    try {
      const ingredientsForAi = formData.ingredients.map((ing) => ({
        name: ing.name,
        weight: ing.weight,
      }))

      const nutrition = await dishesAiApi.calculateNutrition(ingredientsForAi)

      setFormData((prev) => ({
        ...prev,
        calories: nutrition.calories,
        proteins: nutrition.proteins,
        fats: nutrition.fats,
        carbohydrates: nutrition.carbohydrates,
      }))

      toast({
        title: 'КБЖУ рассчитано',
        description: `${Math.round(nutrition.calories)} ккал`,
      })
    } catch (error) {
      console.error('Error calculating nutrition:', error)
      toast({
        title: 'Ошибка',
        description: 'Не удалось рассчитать КБЖУ. Попробуйте позже.',
        variant: 'destructive',
      })
    } finally {
      setIsCalculatingNutrition(false)
    }
  }

  const handleGenerateDescription = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Введите название',
        description: 'Для генерации описания нужно указать название блюда',
        variant: 'destructive',
      })
      return
    }

    setIsGeneratingDescription(true)
    try {
      const description = await dishesAiApi.suggestDescription(formData.name)

      setFormData((prev) => ({
        ...prev,
        description,
      }))

      toast({
        title: 'Описание сгенерировано',
      })
    } catch (error) {
      console.error('Error generating description:', error)
      toast({
        title: 'Ошибка',
        description: 'Не удалось сгенерировать описание. Попробуйте позже.',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingDescription(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setIsSaving(true)
    try {
      const data = {
        ...formData,
        photo: photoFile || undefined,
        cooking_time: formData.cooking_time || undefined,
      }

      if (isEditing && id) {
        await updateDish(parseInt(id, 10), data)
      } else {
        await createDish(data)
      }
      navigate('/dishes')
    } catch (error) {
      console.error('Error saving dish:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading && isEditing) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/dishes')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Редактирование блюда' : 'Новое блюдо'}
          </h1>
        </div>
        <Button type="submit" disabled={isSaving || !formData.name.trim()}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Сохранить
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка */}
        <div className="lg:col-span-2 space-y-6">
          {/* Основная информация */}
          <Card>
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="name">Название блюда *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateRecipe}
                      disabled={isGeneratingRecipe || !formData.name.trim()}
                      className="text-xs h-7"
                    >
                      {isGeneratingRecipe ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3 mr-1" />
                      )}
                      Сгенерировать рецепт
                    </Button>
                  </div>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Например: Овсяная каша с бананом"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="description">Описание</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingDescription || !formData.name.trim()}
                      className="text-xs h-7"
                    >
                      {isGeneratingDescription ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3 mr-1" />
                      )}
                      Сгенерировать
                    </Button>
                  </div>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Краткое описание блюда"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="cooking_time">Время приготовления (мин)</Label>
                  <Input
                    id="cooking_time"
                    name="cooking_time"
                    type="number"
                    min="0"
                    value={formData.cooking_time || ''}
                    onChange={handleInputChange}
                    placeholder="30"
                  />
                </div>

                <div>
                  <Label htmlFor="video_url">Ссылка на видео</Label>
                  <Input
                    id="video_url"
                    name="video_url"
                    type="url"
                    value={formData.video_url}
                    onChange={handleInputChange}
                    placeholder="https://youtube.com/..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ингредиенты */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ингредиенты</CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAiCalculateNutrition}
                  disabled={isCalculatingNutrition || formData.ingredients.length === 0}
                >
                  {isCalculatingNutrition ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-1" />
                  )}
                  AI расчёт
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleRecalculateNutrition}>
                  Пересчитать КБЖУ
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleAddIngredient}>
                  <Plus className="w-4 h-4 mr-1" />
                  Добавить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formData.ingredients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Добавьте ингредиенты для расчёта КБЖУ
                </p>
              ) : (
                <div className="space-y-3">
                  {formData.ingredients.map((ing, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1 grid grid-cols-7 gap-2">
                        <div className="col-span-2">
                          <Input
                            placeholder="Название"
                            value={ing.name}
                            onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                          />
                        </div>
                        <Input
                          type="number"
                          placeholder="Вес, г"
                          value={ing.weight || ''}
                          onChange={(e) => handleIngredientChange(index, 'weight', parseFloat(e.target.value) || 0)}
                        />
                        <Input
                          type="number"
                          placeholder="Ккал"
                          value={ing.calories || ''}
                          onChange={(e) => handleIngredientChange(index, 'calories', parseFloat(e.target.value) || 0)}
                        />
                        <Input
                          type="number"
                          placeholder="Б"
                          value={ing.proteins || ''}
                          onChange={(e) => handleIngredientChange(index, 'proteins', parseFloat(e.target.value) || 0)}
                        />
                        <Input
                          type="number"
                          placeholder="Ж"
                          value={ing.fats || ''}
                          onChange={(e) => handleIngredientChange(index, 'fats', parseFloat(e.target.value) || 0)}
                        />
                        <Input
                          type="number"
                          placeholder="У"
                          value={ing.carbohydrates || ''}
                          onChange={(e) => handleIngredientChange(index, 'carbohydrates', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveIngredient(index)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Рецепт */}
          <Card>
            <CardHeader>
              <CardTitle>Рецепт</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                name="recipe"
                value={formData.recipe}
                onChange={handleInputChange}
                placeholder="Пошаговый рецепт приготовления..."
                rows={8}
              />
            </CardContent>
          </Card>
        </div>

        {/* Правая колонка */}
        <div className="space-y-6">
          {/* Фото */}
          <Card>
            <CardHeader>
              <CardTitle>Фото</CardTitle>
            </CardHeader>
            <CardContent>
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full aspect-[4/3] object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemovePhoto}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full aspect-[4/3] border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <ImagePlus className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Загрузить фото</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </label>
              )}
            </CardContent>
          </Card>

          {/* КБЖУ */}
          <Card>
            <CardHeader>
              <CardTitle>КБЖУ на порцию</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="portion_weight">Вес порции (г)</Label>
                <Input
                  id="portion_weight"
                  name="portion_weight"
                  type="number"
                  min="0"
                  value={formData.portion_weight || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="calories">Калории</Label>
                  <Input
                    id="calories"
                    name="calories"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.calories || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="proteins">Белки (г)</Label>
                  <Input
                    id="proteins"
                    name="proteins"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.proteins || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="fats">Жиры (г)</Label>
                  <Input
                    id="fats"
                    name="fats"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.fats || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="carbohydrates">Углеводы (г)</Label>
                  <Input
                    id="carbohydrates"
                    name="carbohydrates"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.carbohydrates || ''}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Типы приёмов пищи */}
          <Card>
            <CardHeader>
              <CardTitle>Подходит для</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(MEAL_TYPE_LABELS).map(([value, label]) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`meal-${value}`}
                      checked={formData.meal_types.includes(value as MealType)}
                      onCheckedChange={() => handleMealTypeToggle(value as MealType)}
                    />
                    <Label htmlFor={`meal-${value}`} className="cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Теги */}
          {tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Теги</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        formData.tag_ids.includes(tag.id)
                          ? 'ring-2 ring-offset-2'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                        ringColor: tag.color,
                      }}
                      onClick={() => handleTagToggle(tag.id)}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ссылки на покупку */}
          <Card>
            <CardHeader>
              <CardTitle>Где купить</CardTitle>
            </CardHeader>
            <CardContent>
              <ShoppingLinksInput
                links={formData.shopping_links}
                onChange={(links) =>
                  setFormData((prev) => ({ ...prev, shopping_links: links }))
                }
                disabled={isSaving}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}

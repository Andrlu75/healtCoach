const MAX_SIDE = 1500
const QUALITY = 0.85

/**
 * Сжимает изображение до максимального размера стороны и JPEG качества.
 * Фото из галереи может быть 3-10 МБ, после сжатия ~150-300 КБ.
 * GPT-4 Vision внутренне ресайзит до 2048px, поэтому 1500px безопасно.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    let { width, height } = img

    // Если и так меньше — только пережимаем в JPEG 85%
    if (width > MAX_SIDE || height > MAX_SIDE) {
      if (width > height) {
        height = Math.round((height * MAX_SIDE) / width)
        width = MAX_SIDE
      } else {
        width = Math.round((width * MAX_SIDE) / height)
        height = MAX_SIDE
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    )

    if (!blob) return file

    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
      type: 'image/jpeg',
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

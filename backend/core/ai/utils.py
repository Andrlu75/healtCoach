import re


def strip_markdown_codeblock(content: str) -> str:
    """Удаляет markdown code block обёртку из JSON ответа.

    Поддерживаемые форматы:
    - ```json\n{...}\n```
    - ```\n{...}\n```
    - ```json{...}```  (без переносов)
    - ```{...}```
    - Лишний текст после закрывающего ```

    Args:
        content: Строка с возможным markdown code block

    Returns:
        Очищенная строка без markdown обёртки
    """
    content = content.strip()

    # Проверяем, начинается ли с ```
    if not content.startswith('```'):
        return content

    # Убираем открывающий ``` с опциональным json/JSON
    content = re.sub(r'^```(?:json|JSON)?\s*', '', content)

    # Убираем закрывающий ``` и всё после него
    content = re.sub(r'\s*```.*$', '', content, flags=re.DOTALL)

    return content.strip()

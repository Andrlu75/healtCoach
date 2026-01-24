from decimal import Decimal

# Prices in USD per 1M tokens
MODEL_PRICING = {
    # OpenAI
    'gpt-4o': {'input': 2.50, 'output': 10.00},
    'gpt-4o-mini': {'input': 0.15, 'output': 0.60},
    'gpt-4-turbo': {'input': 10.00, 'output': 30.00},
    'gpt-4': {'input': 30.00, 'output': 60.00},
    'gpt-3.5-turbo': {'input': 0.50, 'output': 1.50},
    'o1': {'input': 15.00, 'output': 60.00},
    'o1-mini': {'input': 3.00, 'output': 12.00},
    'o3-mini': {'input': 1.10, 'output': 4.40},
    # Anthropic
    'claude-opus-4-20250514': {'input': 15.00, 'output': 75.00},
    'claude-sonnet-4-20250514': {'input': 3.00, 'output': 15.00},
    'claude-haiku-3-5-20241022': {'input': 0.80, 'output': 4.00},
    'claude-3-5-sonnet-20241022': {'input': 3.00, 'output': 15.00},
    'claude-3-haiku-20240307': {'input': 0.25, 'output': 1.25},
    # DeepSeek
    'deepseek-chat': {'input': 0.27, 'output': 1.10},
    'deepseek-reasoner': {'input': 0.55, 'output': 2.19},
    # Gemini
    'gemini-2.0-flash': {'input': 0.10, 'output': 0.40},
    'gemini-2.0-flash-lite': {'input': 0.075, 'output': 0.30},
    'gemini-1.5-pro': {'input': 1.25, 'output': 5.00},
    'gemini-1.5-flash': {'input': 0.075, 'output': 0.30},
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> Decimal:
    pricing = MODEL_PRICING.get(model)
    if not pricing:
        return Decimal('0')

    input_cost = Decimal(str(pricing['input'])) * Decimal(str(input_tokens)) / Decimal('1000000')
    output_cost = Decimal(str(pricing['output'])) * Decimal(str(output_tokens)) / Decimal('1000000')
    return input_cost + output_cost

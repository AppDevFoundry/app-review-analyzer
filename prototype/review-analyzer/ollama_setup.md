# Ollama Setup Guide for Review Analysis

## Installation

### macOS (using Homebrew)
```bash
brew install ollama
```

### macOS/Windows/Linux (Direct Download)
Download from: https://ollama.com/download

## Getting Started

1. **Start Ollama service**:
   ```bash
   # This runs in the background
   ollama serve
   ```

2. **Pull a model** (recommended for review analysis):
   ```bash
   # Mistral 7B - Good balance of speed and quality
   ollama pull mistral
   
   # OR Llama 3.2 3B - Faster, lighter option
   ollama pull llama3.2:3b
   
   # OR Qwen2.5 7B - Great for multilingual reviews
   ollama pull qwen2.5:7b
   ```

3. **Test the model**:
   ```bash
   ollama run mistral "Hello, can you analyze text?"
   ```

## Running Review Analysis with LLM

Once Ollama is installed and a model is pulled:

```bash
# Basic LLM analysis with default model (mistral)
python3 review_analyzer.py --app-id 1570489264 --llm

# Use a specific model
python3 review_analyzer.py --app-id 1570489264 --llm --model llama3.2:3b

# Full analysis with both JSON and Markdown output
python3 review_analyzer.py --app-id 1570489264 --llm --output both
```

## What the LLM Analyzes

The LLM will analyze low-rated reviews (1-3 stars) to identify:
- Top 3 most common user complaints
- Top 3 feature requests
- Main opportunity for improvement

## Memory Requirements

- 7B models: ~8GB RAM
- 3B models: ~4GB RAM
- 1B models: ~2GB RAM

## Troubleshooting

If you get an error about Ollama not running:
1. Make sure Ollama is installed: `ollama --version`
2. Start the Ollama service: `ollama serve`
3. Check available models: `ollama list`
4. Pull a model if needed: `ollama pull mistral`
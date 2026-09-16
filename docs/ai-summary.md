# AI summary

`summary.enable` enables build-time summarization. `summary.include` limits processing to post paths; an empty list includes all eligible published posts. Encrypted posts and posts with `ai_summary: false` are excluded. Keep credentials out of public templates and assets.

## Multiple providers

```yaml
summary:
  enable: true
  concurrency: 2
  defaultModel: hub/deepseek-v4-flash
  providers:
    - id: hub
      apiUrl: https://gateway.example/v1/chat/completions
      apiKey: YOUR_KEY
      models:
        - deepseek-v4-flash
        - glm-5.3-flash
    - id: another
      apiUrl: https://another.example/v1/chat/completions
      apiKey: ANOTHER_KEY
      models:
        - model: gpt-5.6-luna
          temperature: 0.3
  home:
    mode: switch # switch | original | ai
    default: original # original | ai | provider-id/model-id | model name
```

Provider IDs must be unique and contain only letters, digits, underscores and hyphens. Each enabled provider's models are flattened into a single queue sharing the global concurrency limit across all posts. Set `enable: false` on a provider or model to skip it. Model objects may override provider settings; provider settings inherit shared summary settings. Use full Chat Completions endpoint URLs, not just hostnames.

Cache IDs and `defaultModel` use `provider-id/model-id` (model ID defaults to its request name). Identical model names on different providers do not overwrite each other. Legacy single-provider `models`/`model` remain supported when `providers` is empty. Unchanged legacy cached results are migrated without a new request. A failed model does not prevent successful versions from rendering; an unavailable default falls back to the first successful model in configuration order. Credentials are not written into summary cache or public markup.

`summary.json` (at the blog root) uses format version 3. The `summaries` object is keyed by the SHA-256 hash of each post path (not `abbrlink`). Each value is an array of model results. Entries contain:

- `summary`: plain-text summary.
- `id`: provider-qualified model ID, or the model ID for legacy configurations.
- `provider`: provider ID for multi-provider configurations.
- `sha256`: cache fingerprint of normalized content and generation settings.
- `requestedModel`: configured model at generation time.
- `model`: response model, falling back to the requested model if absent.
- `generatedAt`: timestamp of the successful generation.

Version 2 entries without metadata remain readable. Do not infer their model from current configuration. The card shows a localized unknown-model label unless historical metadata has been explicitly backfilled. Manual corrections to summary text are retained on cache hits; changed content or generation settings trigger regeneration.

Warehouse returns new document instances when Hexo refreshes locals. The summary filter therefore maintains a per-build map and injects summary text and model into `page` through `template_locals`. Do not rely on assigning a transient property to queried post documents.

The article renders an escaped-text card with a native model selector when multiple versions exist. The homepage optionally switches between original excerpts and AI versions; without a generated summary it keeps the original excerpt. Card styles live in `source/css/_common/components/post/ai-summary.styl`; labels are localized. `summary.introduce` is no longer shown as a separate tab.

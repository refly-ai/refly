# FAL + Seedream Tool Billing Pricing Table

**Date**: 2026-02-05
**Source**: FAL.ai pricing pages
**Conversion Rate**: 1 USD = 120 Credits

## Collected Pricing Information

| Tool Library | Method Name | FAL Model URL | Pricing Unit | Price (USD) | Credits/Unit | Field Path | Notes |
|-------------|-------------|---------------|--------------|-------------|--------------|------------|-------|
| **fal_audio** (3) |
| fal_audio | fal-text-to-speech | minimax/speech-2.6-turbo | per 1000 chars | $0.06 | 7.2 | `prompt` (text) | Text-based billing |
| fal_audio | fal-text-to-podcast | vibevoice/7b | per minute | $0.04 | 4.8 | Output `duration_ms` | Rounded to nearest 15s |
| fal_audio | fal-voice-clone | minimax/voice-clone | per audio | $1.00 | 120 | Fixed price | No variable pricing |
| **fal_image** (2) |
| fal_image | flux_text_to_image | flux/dev | per megapixel | $0.025 | 3.0 | `image_size` → megapixels | Complex: needs MP calculation |
| fal_image | flux_image_to_image | flux/dev/i2i | per megapixel | $0.03 | 3.6 | `image_size` → megapixels | Complex: needs MP calculation |
| **fal_video** (1) |
| fal_video | fal-image-to-video | seedance/v1/pro/fast/i2v | $0.243 per 5s@1080p | Variable | Variable | `duration` + `resolution` | Needs token formula |
| **kling** (3) |
| kling | kling-o1-image-to-video | kling-video/o1/standard/i2v | per second | $0.084 | 10.08 | `duration` (input) | Simple duration-based |
| kling | kling-video-to-video | kling-video/o1/standard/v2v/edit | per second | $0.126 | 15.12 | Output video duration | Duration from output |
| kling | kling-ai-avatar | kling-video/ai-avatar/v2/std | per second | $0.0562 | 6.744 | Audio duration | Duration matches audio |
| **veo31** (4) |
| veo31 | veo31-text-to-video | veo3.1/fast | per second | $0.10-$0.35 | 12-42 | `duration` + tiers | Resolution + audio tiers |
| veo31 | veo31-image-to-video | veo3.1/fast/i2v | per second | $0.10-$0.35 | 12-42 | `duration` + tiers | Resolution + audio tiers |
| veo31 | veo31-first-last-frame-to-video | veo3.1/fast/fl2v | per second | $0.10-$0.35 | 12-42 | `duration` + tiers | Resolution + audio tiers |
| veo31 | veo31-video-to-video | veo3.1/fast/extend-video | per second | $0.10-$0.35 | 12-42 | `duration` + tiers | Resolution + audio tiers |
| **wan** (3) |
| wan | wan-text-to-video | wan/v2.6/t2v | per second | $0.10-$0.15 | 12-18 | `duration` + `resolution` | Resolution tiers |
| wan | wan-image-to-video | wan/v2.6/i2v | per second | $0.10-$0.15 | 12-18 | `duration` + `resolution` | Resolution tiers |
| wan | wan-video-to-video | wan/v2.6/reference-to-video | per second | $0.10-$0.15 | 12-18 | `duration` + `resolution` | Resolution tiers |
| **seedream_image** (3) |
| seedream_image | text-to-image | (FAL) seedream/v4.5/t2i | per image | $0.04 | 4.8 | Output `data` array length | Count output images |
| seedream_image | image-to-image | (FAL) seedream/v4.5/i2i | per image | $0.04 | 4.8 | Output `data` array length | Count output images |
| seedream_image | multi-image-fusion | (FAL) seedream/v4.5/fusion | per image | $0.04 | 4.8 | Output `data` array length | Count output images |

## Veo31 Pricing Tiers

| Resolution | Audio | Price/second (USD) | Credits/second |
|------------|-------|-------------------|----------------|
| 720p or 1080p | No | $0.10 | 12.0 |
| 720p or 1080p | Yes | $0.15 | 18.0 |
| 4K | No | $0.30 | 36.0 |
| 4K | Yes | $0.35 | 42.0 |

## Wan Pricing Tiers

| Resolution | Price/second (USD) | Credits/second |
|------------|-------------------|----------------|
| 720p | $0.10 | 12.0 |
| 1080p | $0.15 | 18.0 |

## Implementation Notes

### Simple Configurations (Can implement immediately)
1. **kling-o1-image-to-video** - `duration` field (input), fixed rate
2. **veo31 (all 4 methods)** - `duration` + pricingTiers for resolution/audio combo
3. **wan (all 3 methods)** - `duration` + pricingTiers for resolution
4. **fal-text-to-speech** - `prompt` field (text category), character-based
5. **fal-voice-clone** - Fixed $1, no variable pricing
6. **seedream_image (all 3)** - Count output images from `data` array

**Total simple configs: 12 tools**

### Complex Configurations (Need special handling)
1. **flux_text_to_image / flux_image_to_image** - Megapixel calculation
   - Preset sizes need mapping (square_hd, landscape_4_3, etc.)
   - Custom sizes need width × height / 1,000,000
   - May need code changes in billing-calculation.ts

2. **fal-image-to-video** - Token-based formula
   - tokens(video) = (height × width × FPS × duration) / 1024
   - $1.0 per 1M tokens or $0.243 per 5s@1080p

3. **kling-video-to-video** - Duration from output (not input)
   - Video length determined by input video
   - Need to read output video duration

4. **kling-ai-avatar** - Duration from audio input
   - Video length matches audio
   - May need to parse audio duration

5. **fal-text-to-podcast** - Duration from output
   - Response contains `duration_ms`
   - Rounded to nearest 15 seconds

**Total complex configs: 7 tools**

### Out of Scope (Fish Audio)
- **fish_audio** (3 tools) - Billing strategy not yet implemented

## Sources

- [FLUX.1 dev Text-to-Image](https://fal.ai/models/fal-ai/flux/dev)
- [FLUX.1 dev Image-to-Image](https://fal.ai/models/fal-ai/flux/dev/image-to-image)
- [Kling O1 Image-to-Video](https://fal.ai/models/fal-ai/kling-video/o1/standard/image-to-video)
- [Kling O1 Video-to-Video](https://fal.ai/models/fal-ai/kling-video/o1/standard/video-to-video/edit)
- [Kling AI Avatar v2](https://fal.ai/models/fal-ai/kling-video/ai-avatar/v2/standard)
- [Veo 3.1 Fast](https://fal.ai/models/fal-ai/veo3.1/fast)
- [Wan v2.6 Text-to-Video](https://fal.ai/models/wan/v2.6/text-to-video)
- [MiniMax Speech 2.6 Turbo](https://fal.ai/models/fal-ai/minimax/speech-2.6-turbo)
- [VibeVoice 7B](https://fal.ai/models/fal-ai/vibevoice/7b)
- [MiniMax Voice Clone](https://fal.ai/models/fal-ai/minimax/voice-clone)
- [Bytedance Seedance Image-to-Video](https://fal.ai/models/fal-ai/bytedance/seedance/v1/pro/fast/image-to-video)
- [Seedream v4.5 Pricing (via web search)](https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/text-to-image)

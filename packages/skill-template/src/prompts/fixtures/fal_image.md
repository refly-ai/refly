#### fal_image.py

Usage example:

```python
from refly_tools.fal_image import FalImage
```

Source code:

```python
from typing import Any
from ._toolset import ToolsetBase


class FalImage(ToolsetBase):
    """
    FalImage toolset
    """
    _toolset_key = 'fal_image'

    @classmethod
    def flux_image_to_image(cls, prompt: str, image_url: str, strength: float = 0.95, image_size: str = 'landscape_4_3', num_inference_steps: int = 40, seed: str = None, guidance_scale: float = 3.5, num_images: int = 1, enable_safety_checker: bool = True, output_format: str = 'jpeg') -> Any:
        """
        Image-to-Image transformation with FLUX.1 dev model. Transform existing images based on text prompts - requires an input image. Use this for modifying, restyling, or enhancing existing images with AI-guided transformations.
        
        Args:
            prompt: REQUIRED. Text prompt describing the desired transformation. Be specific about what changes you want. Example: 'Transform into cyberpunk style with neon lights and futuristic elements'
            image_url: REQUIRED. The source image to transform. Accept fileId format (e.g., 'file-abc123') which will be resolved to a URL automatically.
            strength: How much to transform the original image. Higher values = more dramatic changes, lower values = preserve more of original. Range: 0.01-1.0. Default: 0.95
            image_size: The size of the output image. Can be a preset enum value OR a custom object with width/height. Preset options: square_hd, square, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9. Default: 'landscape_4_3'
            num_inference_steps: The number of inference steps to perform. Higher values produce better quality but take longer. Range: 10-50. Default: 40
            seed: Random seed for reproducibility. The same seed and prompt will produce the same image.
            guidance_scale: CFG (Classifier Free Guidance) scale. Higher values make the model stick closer to the prompt. Range: 1-20. Default: 3.5
            num_images: Number of images to generate. Range: 1-4. Default: 1
            enable_safety_checker: Enable NSFW content safety checker. Default: true
            output_format: Output image format. Options: jpeg, png. Default: 'jpeg'
        """
        pass

    @classmethod
    def flux_text_to_image(cls, prompt: str, image_size: str = 'landscape_4_3', num_inference_steps: int = 28, seed: str = 42, guidance_scale: float = 3.5, num_images: int = 1, enable_safety_checker: bool = True, output_format: str = 'jpeg', acceleration: str = 'none') -> Any:
        """
        Text-to-Image generation with FLUX.1 dev model. Generate high-quality images from text prompts only - no input image required. Use this for creating new images from scratch based on text descriptions.
        
        Args:
            prompt: REQUIRED. The text prompt to generate an image from. Be as descriptive as possible for best results. Example: 'A photorealistic cat wearing sunglasses on a beach at sunset, detailed fur texture, golden hour lighting'
            image_size: The size of the generated image. Can be a preset enum value OR a custom object with width/height. Preset options: square_hd, square, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9. Default: 'landscape_4_3'
            num_inference_steps: The number of inference steps to perform. Higher values produce better quality but take longer. Range: 1-50. Default: 28
            seed: Random seed for reproducibility. The same seed and prompt will produce the same image. Default: 42
            guidance_scale: CFG (Classifier Free Guidance) scale. Higher values make the model stick closer to the prompt. Range: 1-20. Default: 3.5
            num_images: Number of images to generate. Range: 1-4. Default: 1
            enable_safety_checker: Enable NSFW content safety checker. Default: true
            output_format: Output image format. Options: jpeg, png. Default: 'jpeg'
            acceleration: Generation speed mode. Higher speed = faster but potentially lower quality. Options: none, regular, high. Default: 'none'
        """
        pass
```
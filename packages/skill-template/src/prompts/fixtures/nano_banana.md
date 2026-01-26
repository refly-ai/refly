#### nano_banana.py

Usage example:

```python
from refly_tools.nano_banana import NanoBanana
```

Source code:

```python
from typing import Any
from ._toolset import ToolsetBase


class NanoBanana(ToolsetBase):
    """
    NanoBanana toolset
    """
    _toolset_key = 'nano_banana'

    @classmethod
    def generate_image(cls, contents: list, generationConfig: dict) -> Any:
        """
        Nano Banana Image Generation API. Generate high-quality AI images from text prompts. Only aspect ratio can be adjusted - resolution/image size/quality settings are NOT supported. IMPORTANT: Must use this exact structure: {"contents": [{"parts": [{"text": "your detailed prompt"}]}], "generationConfig": {"imageConfig": {"aspectRatio": "16:9"}}}. Do NOT flatten the nested structure. Note: imageSize/resolution/size parameters are NOT supported and will cause errors - only use aspectRatio.
        
        Args:
            contents: Content array for Nano Banana image generation request. Must contain exactly one content object, and that object MUST have a ''parts'' array inside it. Structure: [{"parts": [...]}]
            generationConfig: REQUIRED configuration object. Structure: {"imageConfig": {"aspectRatio": "16:9"}}. CRITICAL: Do NOT include 'imageSize' parameter - it is NOT supported and will cause errors. Only 'aspectRatio' is allowed inside imageConfig.
        """
        pass
```
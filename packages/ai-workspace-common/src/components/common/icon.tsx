import {
  HiOutlineDocumentText,
  HiOutlineSquare3Stack3D,
  HiOutlineSparkles,
  HiSparkles,
  HiOutlineChatBubbleLeftRight,
  HiMiniPlayCircle,
  HiOutlineCircleStack,
  HiPlus,
  HiMinus,
} from 'react-icons/hi2';
import { IoIosMore } from 'react-icons/io';
import { HiOutlineReply } from 'react-icons/hi';
import {
  LuSearch,
  LuSettings,
  LuCheck,
  LuCopy,
  LuTrash,
  LuRotateCw,
  LuBrain,
  LuGift,
  LuSparkles,
} from 'react-icons/lu';
import { LuView, LuPlay } from 'react-icons/lu';
import { RiErrorWarningLine } from 'react-icons/ri';

import { RiDoubleQuotesL } from 'react-icons/ri';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { BiText } from 'react-icons/bi';
import { PiNotePencil, PiNotePencilLight, PiShootingStar } from 'react-icons/pi';

import { IoLibraryOutline } from 'react-icons/io5';
import { HiOutlineChevronDown } from 'react-icons/hi';

import OpenAIIcon from '@refly-packages/ai-workspace-common/assets/openai.svg';
import ClaudeIcon from '@refly-packages/ai-workspace-common/assets/claude.svg';
import GeminiIcon from '@refly-packages/ai-workspace-common/assets/gemini.svg';
import QwenIcon from '@refly-packages/ai-workspace-common/assets/qwen.svg';
import MetaLlamaIcon from '@refly-packages/ai-workspace-common/assets/meta.svg';
import DeepSeekIcon from '@refly-packages/ai-workspace-common/assets/deepseek.svg';

export const IconCanvasFill = HiSparkles;
export const IconCanvas = HiOutlineSparkles;
export const IconAskAI = LuSparkles;
export const IconDocument = HiOutlineDocumentText;
export const IconResource = HiOutlineSquare3Stack3D;
export const IconMemo = PiNotePencilLight;
export const IconResponse = HiOutlineChatBubbleLeftRight;
export const IconLibrary = IoLibraryOutline;
export const IconThread = HiOutlineChatBubbleLeftRight;
export const IconPreview = LuView;
export const IconQuote = RiDoubleQuotesL;
export const IconToken = HiOutlineCircleStack;
export const IconText = BiText;
export const IconPlus = HiPlus;
export const IconMinus = HiMinus;
export const IconCheck = LuCheck;
export const IconPlay = HiMiniPlayCircle;
export const IconRun = LuPlay;
export const IconRerun = LuRotateCw;
export const IconReply = HiOutlineReply;
export const IconMoreHorizontal = IoIosMore;
export const IconEdit = PiNotePencil;
export const IconDelete = LuTrash;
export const IconSearch = LuSearch;
export const IconError = RiErrorWarningLine;
export const IconLoading = AiOutlineLoading3Quarters;
export const IconSettings = LuSettings;
export const IconCopy = LuCopy;
export const IconModel = LuBrain;
export const IconDown = HiOutlineChevronDown;
export const IconSubscription = LuGift;

export const ModelProviderIcons = {
  openai: OpenAIIcon,
  anthropic: ClaudeIcon,
  google: GeminiIcon,
  qwen: QwenIcon,
  'meta-llama': MetaLlamaIcon,
  deepseek: DeepSeekIcon,
};

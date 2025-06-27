import { Provider, ProviderCategory } from '@refly-packages/ai-workspace-common/requests/types.gen';

// Pricing model for community providers
export type ProviderPricingModel = 'free' | 'paid' | 'freemium';

// Provider configuration field
export interface ProviderConfigField {
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  defaultValue?: any;
  placeholder?: string;
  description?: string;
}

// Community provider configuration type
export interface CommunityProviderConfig {
  providerId: string;
  name: string;
  providerKey: string;
  baseUrl?: string;
  description:
    | string
    | {
        en: string;
        'zh-CN': string;
      };
  icon?: string;
  categories: ProviderCategory[];
  category?: string; // Added for backwards compatibility
  pricing?: ProviderPricingModel;
  popularity?: number;
  author?: string;
  version?: string;
  documentation?: string;
  website?: string;

  tags?: string[];
}

// Community provider response type
export interface CommunityProviderResponse {
  providers: CommunityProviderConfig[];
  meta?: {
    total: number;
    lastUpdated: string;
  };
}

// Community provider card props
export interface CommunityProviderCardProps {
  config: CommunityProviderConfig;
  isInstalled: boolean;
  isInstalling?: boolean;
  onInstall?: (config: CommunityProviderConfig) => void;
  onInstallStart?: (config: CommunityProviderConfig) => void;
  onInstallError?: (config: CommunityProviderConfig, error: any) => void;
  onViewDetails?: (config: CommunityProviderConfig) => void;
}

// Community provider list props
export interface CommunityProviderListProps {
  visible: boolean;
  installedProviders: Provider[];
  onInstallSuccess: () => void;
}

// Community provider filter state
export interface CommunityProviderFilterState {
  searchText: string;
  selectedCategory: ProviderCategory | 'all';
  selectedPricing: ProviderPricingModel | 'all';
  selectedTags: string[];
}

// Provider install modal props
export interface ProviderInstallModalProps {
  visible: boolean;
  config: CommunityProviderConfig | null;
  onClose: () => void;
  onSuccess: (provider: Provider) => void;
  loading?: boolean;
}

// Provider store filters props
export interface ProviderStoreFiltersProps {
  filters: CommunityProviderFilterState;
  onFiltersChange: (filters: CommunityProviderFilterState) => void;
  categories: ProviderCategory[];
  availableTags: string[];
}

// Provider detail props
export interface ProviderDetailProps {
  config: CommunityProviderConfig;
  visible: boolean;
  onClose: () => void;
  onInstall: (config: CommunityProviderConfig) => void;
  isInstalled: boolean;
}

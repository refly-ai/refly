import { Provider, ProviderCategory } from '@refly/openapi-schema';

// Pricing model for community providers
export type ProviderPricingModel = 'free' | 'paid' | 'freemium';

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

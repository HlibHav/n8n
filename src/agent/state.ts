import { BaseMessage, BaseMessageLike } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

/**
 * Fashion Agent State - defines the structure for fashion creative generation
 */

// Profile interface for customer data
export interface Profile {
  contact_id: string;
  email: string;
  firstname: string;
  locale: string;
  country: string;
  city: string;
  tags: string[];
  interest_keywords: string[];
}

// Product interface for fashion items
export interface Product {
  sku: string;
  title: string;
  category: 'hoodies' | 'sneakers' | 'outerwear' | 'denim' | 'accessories' | 'dresses' | 'tops' | 'bottoms' | 'handbag';
  colorways: string[];
  price_band: 'value' | 'mid' | 'premium' | 'luxury';
  launch_type: 'drop' | 'evergreen' | 'sale';
  brand_name: string;
}

// Persona types
export type PersonaType = 'Streetwear' | 'Minimalist' | 'LuxuryClassic' | 'Athleisure';

// Options for creative generation
export interface Options {
  aspect: '1:1' | '4:5' | '9:16';
  channel: 'instagram_feed' | 'instagram_story' | 'email' | 'web_banner';
  fallback_image_url: string;
  ab_variant: 'A' | 'B' | 'C';
}

// Generated creative content
export interface CreativeContent {
  image_url?: string;
  copy: {
    subject?: string;
    body?: string;
  };
  persona: PersonaType;
  color_palette: string[];
  bfl_prompt?: string;
  polling_url?: string;
  request_id?: string;
}

// Error handling
export interface ErrorState {
  error?: string;
  retry_count: number;
}

export const StateAnnotation = Annotation.Root({
  // Messages for conversation flow
  messages: Annotation<BaseMessage[], BaseMessageLike[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  
  // Input data
  profile: Annotation<Profile | null>({
    value: (left, right) => right ?? left,
    default: () => null,
  }),
  
  product: Annotation<Product | null>({
    value: (left, right) => right ?? left,
    default: () => null,
  }),
  
  options: Annotation<Options | null>({
    value: (left, right) => right ?? left,
    default: () => null,
  }),
  
  // Generated content
  creative: Annotation<CreativeContent | null>({
    value: (left, right) => right ?? left,
    default: () => null,
  }),
  
  // Persona inference
  persona: Annotation<PersonaType | null>({
    value: (left, right) => right ?? left,
    default: () => null,
  }),
  
  // Error handling
  error: Annotation<ErrorState | null>({
    value: (left, right) => right ?? left,
    default: () => null,
  }),
  
  // Processing status
  status: Annotation<string>({
    value: (left, right) => right ?? left,
    default: () => 'pending',
  }),
});

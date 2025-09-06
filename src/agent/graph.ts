import { StateGraph, END } from "@langchain/langgraph";
import { StateAnnotation } from "./state";
import { PersonaType, Product, CreativeContent } from "./state";

// Persona inference function
const inferPersona = async (
  state: typeof StateAnnotation.State
): Promise<typeof StateAnnotation.Update> => {
  if (!state.profile || !state.product) {
    return { error: { error: "Missing required data for persona inference", retry_count: 0 } };
  }

  const { profile, product } = state;
  
  // Simple persona inference based on profile data
  let persona: PersonaType;
  
  if (profile.age_range === "18-25" && profile.gender === "Male") {
    persona = "Streetwear";
  } else if (profile.age_range === "26-35" && profile.gender === "Female") {
    persona = "Minimalist";
  } else if (profile.age_range === "36-45" && profile.price_tier_demographics === "Premium") {
    persona = "LuxuryClassic";
  } else if (profile.age_range === "18-35" && profile.preferred_category === "Athleisure") {
    persona = "Athleisure";
  } else {
    // Default to Streetwear for younger demographics, Minimalist for others
    persona = parseInt(profile.age_range.split('-')[0]) < 30 ? "Streetwear" : "Minimalist";
  }

  console.log(`🎭 Inferred persona: ${persona} for profile:`, profile);
  
  return { persona };
};

// Create BFL prompt based on persona and product
function createBFLPrompt(persona: PersonaType, product: Product, profile?: any): string {
  // Use preferred category from profile, fallback to fashion
  const category = profile?.preferred_category || 'fashion';

  const categoryPrompts: { [key: string]: string } = {
    fashion: `Fashion product photography of ${product.title} by ${product.brand_name}`,
    lifestyle: `Lifestyle product photography of ${product.title} by ${product.brand_name}`,
    beauty: `Beauty product photography of ${product.title} by ${product.brand_name}`,
    travel: `Travel lifestyle photography featuring ${product.title} by ${product.brand_name}`,
    food: `Food and dining photography featuring ${product.title} by ${product.brand_name}`,
    tech: `Tech product photography of ${product.title} by ${product.brand_name}`
  };

  const basePrompt = categoryPrompts[category] || categoryPrompts.fashion;

  const personaPrompts = {
    Streetwear: `urban street style, graffiti background, neon lighting, chunky sneakers, oversized fit, edgy aesthetic`,
    Minimalist: `clean minimal studio, soft natural lighting, neutral colors, editorial style, beige background`,
    LuxuryClassic: `luxury studio setup, elegant marble background, softbox lighting, silk textures, gold accents`,
    Athleisure: `athletic lifestyle, gym or outdoor setting, dynamic lighting, sporty aesthetic, active lifestyle`
  };

  const colorPalette = product.colorways.join(', ');

  return `${basePrompt}, ${personaPrompts[persona]}, colors: ${colorPalette}, high quality, professional photography, 4K resolution`;
}

// Image generation function using BFL API
const generateImage = async (
  state: typeof StateAnnotation.State
): Promise<typeof StateAnnotation.Update> => {
  if (!state.profile || !state.product || !state.options || !state.persona) {
    return { error: { error: "Missing required data for image generation", retry_count: 0 } };
  }

  const bflApiKey = process.env.BFL_API_KEY;
  
  if (!bflApiKey) {
    throw new Error('BFL_API_KEY environment variable is required');
  }
  
  // Create BFL prompt based on persona and product
  const bflPrompt = createBFLPrompt(state.persona, state.product, state.profile);
  
  try {
    console.log('🎨 Generating image with BFL API...');
    console.log('🔍 BFL Prompt:', bflPrompt);
    console.log('🔑 API Key present:', !!bflApiKey);
    console.log('🔑 API Key (first 10 chars):', bflApiKey.substring(0, 10) + '...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

    const response = await fetch('https://api.bfl.ai/v1/flux-pro-1.1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-key': bflApiKey,
        'accept': 'application/json',
        'User-Agent': 'Fashion-Creative-Agent/1.0'
      },
      body: JSON.stringify({
        prompt: bflPrompt,
        width: 1024,
        height: 1024
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log('🔍 BFL API Response Status:', response.status);
    console.log('🔍 BFL API Response Headers:', {
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length')
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ BFL API Error Response:', errorText);
      throw new Error(`BFL API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ BFL API Success Response:', result);

    // BFL returns polling information
    const creative: CreativeContent = {
      image_url: result.polling_url || 'https://via.placeholder.com/1024x1024/cccccc/666666?text=Image+Generating...',
      copy: '', // Will be filled by copy generation
      persona: state.persona,
      polling_url: result.polling_url,
      request_id: result.request_id
    };

    return { creative };

  } catch (error) {
    console.error('❌ Image generation failed:', error);
    return { error: { error: `Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, retry_count: 0 } };
  }
};

// Copy generation function using OpenAI
const generateCopy = async (
  state: typeof StateAnnotation.State
): Promise<typeof StateAnnotation.Update> => {
  if (!state.profile || !state.product || !state.persona || !state.creative) {
    return { error: { error: "Missing required data for copy generation", retry_count: 0 } };
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
        'User-Agent': 'Fashion-Creative-Agent/1.0'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a creative copywriter specializing in fashion and lifestyle marketing. 
            Generate compelling, brand-appropriate copy that resonates with the target persona. 
            Keep copy concise, engaging, and action-oriented.`
          },
          {
            role: 'user',
            content: `Create marketing copy for:
            Product: ${state.product.title} by ${state.product.brand_name}
            Persona: ${state.persona}
            Profile: ${JSON.stringify(state.profile)}
            Tone: ${state.options?.copy_tone || 'professional'}
            
            Generate 2-3 short, punchy copy options.`
          }
        ],
        max_tokens: 200,
        temperature: 0.8
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    const copy = result.choices[0]?.message?.content || 'Discover the perfect style for you.';

    // Update the creative with the generated copy
    const updatedCreative: CreativeContent = {
      ...state.creative,
      copy: copy
    };

    return { creative: updatedCreative };

  } catch (error) {
    console.error('❌ Copy generation failed:', error);
    return { error: { error: `Copy generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, retry_count: 0 } };
  }
};

// Route function to determine next step
const route = (state: typeof StateAnnotation.State): string => {
  if (state.error) {
    return "error";
  }
  
  if (!state.persona) {
    return "inferPersona";
  }
  
  if (!state.creative) {
    return "generateImage";
  }
  
  if (!state.creative.copy) {
    return "generateCopy";
  }
  
  return "end";
};

// Create the workflow graph
export const workflow = new StateGraph(StateAnnotation)
  .addNode("inferPersona", inferPersona)
  .addNode("generateImage", generateImage)
  .addNode("generateCopy", generateCopy)
  .addNode("error", (state) => {
    console.error("❌ Workflow error:", state.error);
    return { error: state.error };
  })
  .addNode("end", (state) => {
    console.log("✅ Workflow completed successfully");
    return state;
  })
  .addEdge("inferPersona", "generateImage")
  .addEdge("generateImage", "generateCopy")
  .addEdge("generateCopy", "end")
  .addEdge("error", END)
  .addEdge("end", END)
  .addConditionalEdges(
    "start",
    route,
    {
      "inferPersona": "inferPersona",
      "generateImage": "generateImage", 
      "generateCopy": "generateCopy",
      "error": "error",
      "end": "end"
    }
  );

export const app = workflow.compile();

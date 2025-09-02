import OpenAI from 'openai';
import { AIServiceConfig, ChatContext, AIResponse, MCPToolDef } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class OpenAIService {
  private openai: OpenAI;
  private config: AIServiceConfig;
  private availableTools: MCPToolDef[] = [];

  constructor(config: AIServiceConfig) {
    this.config = {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      ...config
    };

    this.openai = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  setAvailableTools(tools: MCPToolDef[]) {
    this.availableTools = Array.isArray(tools) ? tools : [];
    logger.info(`Updated available tools: ${this.availableTools.map(t => t.name).join(', ')}`);
  }

  private getDoWhistleKnowledge(): string {
    return `
You are the DoWhistle Assistant — a focused helper for the DoWhistle hyperlocal platform. 

About DoWhistle (brand & positioning)
- Taglines: "Search on the move." "Bridging the 'Need' and 'Have'." "Answering all your needs; just one 'Whistle' away."
- What it is: A location-based, two-sided platform that connects nearby "Whistlers" (providers and consumers) and alerts them when a match is close by. Users can search, post a Whistle (need or offer), and connect directly.

Core concepts
- Provider Whistlers:
  • Taxi & ride-share providers (affordable subscription, local-government guided fares, no surge, in-app meter, know drop points before accepting).
  • Service providers (plumbers, handymen, etc.).
  • Retail businesses (post nearby offers/deals).
  • Custom Whistlers (unique skills or "have" items).
- Consumer Whistlers:
  • Discover nearby providers for rides, services, and retail offers without heavy searching.
  • Create Consumer Whistles to get alerts when matching providers are nearing.
- Platform scope:
  • DoWhistle facilitates discovery, matching, and communication. Payments are not processed by DoWhistle; users handle transactions directly.
  • Available on iOS and Android (download links on the DoWhistle site).

What you can help with
1) Explain how DoWhistle works (provider vs. consumer, tags, alerts, matching).
2) Guide users to create effective Whistles:
   - Choose Provider or Consumer.
   - Add tags (e.g., Ride Share, Plumber, Offer Share).
   - Add details/description.
   - Set alert radius.
   - Set expiry (1–24 hours or always on).
3) Help users discover categories (rides, local services, retail offers) and how to connect with Whistlers (call/SMS from profiles).
4) Offer app guidance: anonymous browsing vs. registered features, adjusting search radius, OTP/troubleshooting basics, ratings (thumbs up/down).
5) Clarify guardrails: DoWhistle doesn't take payments or charge commissions; no guarantees on transactions. Encourage safe, direct communication.

Tone & boundaries
- Be concise, helpful, and brand-true.
- Do NOT answer general or off-topic questions. However, you CAN retrieve personal information if a tool is available and the user is authenticated.
- When asked to "book" or "hire," guide the user to post/search in the app and connect with nearby Whistlers.
- Keep recommendations strictly within DoWhistle's services and features.
`;
  }

  async processMessage(message: string, context: ChatContext = {}): Promise<AIResponse> {
    try {
      logger.info('Processing message with OpenAI', {
        messageLength: message.length,
        hasContext: !!Object.keys(context).length
      });

      const toolsContext = this.availableTools.length
        ? `\n\n## Available MCP Tools\n\nYou have access to the following DoWhistle tools. Analyze the user's request and determine if any tool should be called:\n\n${this.availableTools.map(t => {
            const inputSchema = t.inputSchema?.properties || {};
            const requiredParams = t.inputSchema?.required || [];
            const paramsDesc = Object.entries(inputSchema).map(([key, value]: [string, any]) => {
              const required = requiredParams.includes(key) ? ' (required)' : ' (optional)';
              return `  - ${key}: ${value.description || 'No description'}${required}`;
            }).join('\n');

            return `### ${t.name}\n**Description:** ${t.description}\n**Parameters:**\n${paramsDesc}\n**Example usage:** ${t.name}(${Object.keys(inputSchema).join(', ')})`;
          }).join('\n\n')}\n\n## Tool Calling Instructions\n\nWhen you detect that the user wants to use a tool:\n1. Respond ONLY with a JSON object in this exact format: {"tool":"tool_name","args":{"param1":"value1"}}\n2. Include ALL required parameters for the tool\n3. For protected tools (create_whistle, list_whistles, toggle_visibility, get_user_profile), always include access_token parameter\n4. Do NOT include any explanatory text, just the JSON\n5. If no tool applies, respond with normal conversational text\n\n## Authentication Note\nProtected tools require authentication. The access_token parameter will be automatically populated with the user's authentication token if available.`
        : '';

      const systemPrompt = `${this.getDoWhistleKnowledge()}\n\n## Current User Context\n${JSON.stringify(context, null, 2)}${toolsContext}`;

      const completion = await this.openai.chat.completions.create({
        model: this.config.model!,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: this.config.temperature,
        max_tokens: 1024  // Increased to allow for tool call JSON
      });

      const responseText = completion.choices[0]?.message?.content ||
        "I'm here to help with DoWhistle — rides, local services, and nearby offers. What do you need?";

      logger.info('OpenAI response received', { responseLength: responseText.length });

      return this.parseAIResponse(responseText, message, context);
    } catch (error) {
      logger.error('Error processing message with OpenAI:', error);
      return {
        text: "I'm having trouble responding right now. Please try again, or tell me how I can help with DoWhistle services."
      };
    }
  }

    private parseAIResponse(responseText: string, originalMessage: string, _context: ChatContext): AIResponse {
    const actions: Array<{ type: string; data: any }> = [];
    const suggestions: string[] = [];

    logger.debug('Parsing AI response', { responseText });

    // Try to detect a pure JSON tool action
    const jsonCandidates: string[] = [];
    const fenced = responseText.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
    if (fenced && fenced[1]) jsonCandidates.push(fenced[1].trim());

    // Also consider the whole string if it looks like JSON
    if (responseText.trim().startsWith('{') && responseText.trim().endsWith('}')) {
      jsonCandidates.push(responseText.trim());
    }

    for (const candidate of jsonCandidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object' && parsed.tool && parsed.args) {
          logger.info('Valid tool call found', { tool: parsed.tool });
          actions.push({ type: 'mcp_tool', data: parsed });
          return { text: '', actions };
        }
      } catch (e) {
        logger.debug('Failed to parse JSON candidate', { candidate });
      }
    }

    // Add contextual actions based on message content
    if (responseText.toLowerCase().includes('book') || originalMessage.toLowerCase().includes('book')) {
      actions.push({ type: 'booking_intent', data: { message: originalMessage } });
    }
    if (responseText.toLowerCase().includes('location') || originalMessage.toLowerCase().includes('location')) {
      actions.push({ type: 'location_request', data: {} });
    }

    // Generate suggestions based on message content
    if (originalMessage.toLowerCase().includes('price')) {
      suggestions.push('Get quotes', 'Compare providers');
    } else if (originalMessage.toLowerCase().includes('book')) {
      suggestions.push('Choose service type', 'Set pickup location');
    } else {
      suggestions.push('Book a ride', 'Find services', 'See offers');
    }

    return {
      text: responseText,
      suggestions: suggestions.length ? suggestions : undefined,
      actions: actions.length ? actions : undefined
    };
  }
}

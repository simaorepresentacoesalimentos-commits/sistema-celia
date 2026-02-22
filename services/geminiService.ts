
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Sale } from "../types";

export const getAIAnalysis = async (products: Product[], sales: Sale[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analise os seguintes dados de um sistema de vendas e forneça insights estratégicos em formato JSON.
    Produtos: ${JSON.stringify(products)}
    Vendas Recentes: ${JSON.stringify(sales)}
    
    Por favor, identifique:
    1. Produto mais vendido e lucrativo.
    2. Sugestão de promoção baseada no histórico.
    3. Tendência de crescimento para o próximo mês.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mostProfitable: { type: Type.STRING },
            promoSuggestion: { type: Type.STRING },
            trendAnalysis: { type: Type.STRING }
          },
          required: ["mostProfitable", "promoSuggestion", "trendAnalysis"]
        }
      }
    });

    // Fix: response.text is a property, ensuring we handle potential undefined or empty values
    const jsonStr = response.text?.trim() || "{}";
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Erro ao chamar Gemini:", error);
    return null;
  }
};

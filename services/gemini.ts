import { GoogleGenAI } from "@google/genai";

// Safely access the API key.
// Note: In a production environment, these calls should likely be proxied through a backend 
// to keep the key secure, but for this client-side demo, we use the env var directly.
const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

/**
 * Generates a short, vibe-based description for a music track.
 */
export const generateTrackDescription = async (title: string, artist: string): Promise<string> => {
  if (!apiKey) {
    console.warn("No API Key found for Gemini.");
    return "Add an API Key to generate descriptions.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write a very short, cool, 10-15 word 'vibe' description for a song titled "${title}" by "${artist}". Do not use quotes.`,
    });
    
    return response.text?.trim() || "No description generated.";
  } catch (error) {
    console.error("Error generating track description:", error);
    return "Could not generate description at this time.";
  }
};

/**
 * Suggests a playlist name based on a list of tracks.
 */
export const generatePlaylistName = async (tracks: {title: string, artist: string}[]): Promise<string> => {
    if (!apiKey || tracks.length === 0) return "My Mix";

    try {
        const trackList = tracks.slice(0, 10).map(t => `${t.title} by ${t.artist}`).join(', ');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Suggest a creative, short (2-3 words) playlist name for these songs: ${trackList}. Do not use quotes.`,
        });
        return response.text?.trim() || "My Mix";
    } catch (e) {
        return "My Mix";
    }
}
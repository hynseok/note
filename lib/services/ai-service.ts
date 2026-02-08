import { GoogleGenerativeAI } from "@google/generative-ai";

export class AIService {
    private static genAI: GoogleGenerativeAI;
    private static modelName = "gemini-2.5-flash-lite"; // Or "gemini-1.5-flash" depending on needs

    private static getClient() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not defined in environment variables.");
        }
        if (!this.genAI) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        }
        return this.genAI;
    }

    /**
     * Summarizes the provided text using Gemini.
     * 
     * @param text The text to summarize (e.g. paper content)
     * @returns The generated summary
     */
    static async summarizePaper(text: string): Promise<string> {
        try {
            const client = this.getClient();
            const model = client.getGenerativeModel({ model: this.modelName });

            // TODO: Truncate text if too long (Gemini Pro has 30k token limit, 1.5 Flash has 1M)
            // For now, let's assume reasonable length or use 1.5 Flash if needed.
            // 20-year dev note: Robustness improvements -> Token counting / chunking.
            // Simplified for MVP.

            const prompt = `
            You are an expert Senior Researcher in Computer Science and Engineering.\n
            Your task is to perform a deep-dive analysis of the provided research paper.\n
            You must go beyond a simple summary and provide a critical evaluation of the technical architecture, methodology, and experimental results.\n
            Focus especially on technical novelty and implementation feasibility.\n
            \n
            Please analyze the attached paper in detail according to the following structure:\n
            Core Problem & Motivation: What is the specific technical gap or inefficiency the authors are trying to solve? Why is this problem significant in the current CS landscape?\n
            Key Contributions: List the primary original contributions of this work.\n
            Technical Methodology: Describe the proposed system/method in detail. If applicable, explain the hardware/software stack, security models, or specific instruction set used.\n
            Experimental Evaluation:\n
            - What benchmarks were used?\n
            - What was the baseline for comparison?\n
            - Are the results statistically significant and convincing?\n
            Critical Analysis & Limitations: Identify potential weaknesses. Are there any hidden overheads, scalability issues, or unrealistic assumptions in the threat model/environment?\n
            Future Research Directions: How can this work be extended or integrated into other domains?\n
            \n
            Structure your response with clear Markdown formatting.\n
            **Note**: Use bolding for key terms. Ensure there is a blank line between sections and paragraphs for readability. Do not start with "Here is a ...". Start with Paper Title (# Paper Title) and conference name (#### Conference Name).\n
            \n
            Paper Content:
            ${text.substring(0, 150000)} 
            `;
            // Safety Truncate to ~30k chars to avoid basic limits if using Pro standard.
            // Better to use 1.5 Flash for large context.

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("[AI_SERVICE_ERROR]", error);
            throw new Error("Failed to generate summary.");
        }
    }
}

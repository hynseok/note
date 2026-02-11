import { GoogleGenerativeAI } from "@google/generative-ai";

export class AIService {
    private static genAI: GoogleGenerativeAI;


    private static getClient() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not defined in environment variables.");
        }
        if (!this.genAI) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        }
        return this.genAI;
    }

    private static MODELS = [
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemma-3-27b-it"
    ];

    /**
     * Summarizes the provided text using Gemini.
     * 
     * @param text The text to summarize (e.g. paper content)
     * @returns The generated summary
     */
    static async summarizePaper(text: string): Promise<string> {
        const client = this.getClient();
        let lastError: any = null;

        for (const modelName of this.MODELS) {
            try {
                // console.log(`[AI_SERVICE] Attempting with model: ${modelName}`);
                const model = client.getGenerativeModel({ model: modelName });

                // TODO: Truncate text if too long (Gemini Pro has 30k token limit, 1.5 Flash has 1M)
                // For now, let's assume reasonable length or use 1.5 Flash if needed.
                // 20-year dev note: Robustness improvements -> Token counting / chunking.
                // Simplified for MVP.

                const prompt = `
                You are an expert Senior Researcher in Computer Science and Engineering.\n
                Your task is to conduct a comprehensive, robust, and exhaustive analysis of the provided research paper.\n
                You must go beyond a simple summary and provide a critical evaluation of the technical architecture, methodology, and experimental results.\n
                Focus deeply on technical novelty, implementation details, and the validity of the claims.\n
                \n
                Please analyze the attached paper in detail according to the following structure:\n
                
                ### Core Problem & Motivation
                - What specific problem, inefficiency, or research opportunity does this work address? (Focus on the motivation: improving state-of-the-art, solving a specific issue, or challenging existing assumptions.)
                - Why is this problem significant in the current CS landscape?
                
                ### Key Contributions
                - List the primary original contributions of this work clearly.

                ### Detailed Section Summary (Comprehensive Coverage)
                - Provide a step-by-step summary of the paper's content, section by section (e.g., Introduction, Related Work, System Design, implementation, Evaluation, Conclusion).
                - Ensure no major section is skipped. Capture the key points and logic flow of each part.
                
                ### Technical Methodology (Deep Dive)
                - Describe the proposed system/method in technical detail.
                - If applicable, explain the hardware/software stack, algorithms, specific optimizations, or security models used.
                
                ### Experimental Evaluation
                - **Benchmarks**: What datasets and workloads were used?
                - **Baselines**: What systems was it compared against?
                - **Quantitative Results**: Extract key performance numbers (e.g., "2.5x speedup", "15% accuracy improvement"). Are the results statistically significant and convincing?
                
                ### Critical Analysis & Limitations (Robustness Check)
                - **Strengths**: What does the system do exceptionally well?
                - **Weaknesses**: Identify potential flaws, hidden overheads, or scalability issues.
                - **Assumptions**: Are there any unrealistic assumptions in the threat model or environment?
                
                ### Future Research Directions & Impact
                - How can this work be extended or integrated into other domains?
                - What is the long-term impact of this work?
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
                console.error(`[AI_SERVICE] Failed with model ${modelName}:`, error);
                lastError = error;
                // Continue to next model
            }
        }

        console.error("[AI_SERVICE_ERROR] All models failed.", lastError);
        throw new Error("Failed to generate summary with all available models.");
    }
}

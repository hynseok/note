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

                const prompt = `
                # Role
                - You are an expert Researcher in Computer Science and Engineering.\n
                # Task
                - Your task is to conduct a comprehensive, robust, and exhaustive analysis of the provided research paper.\n
                - You must go beyond a simple summary and provide a critical evaluation of the problems and solutions, methodology, and experimental results.\n
                \n
                # Persona
                - Your persona is a conference presenter.\n
                - You should use full sentences and paragraphs to explain your analysis.\n
                \n
                # Structure
                - Please analyze the attached paper in detail according to the following structure:\n
                
                ### Core Problem & Motivation
                - In this section, you should answer following questions:\n
                    - What problem are the authors trying to solve?
                    - Why is the problem important?
                    - Why is the problem not solved by earlier work?
                    - What are challenges when addressing the problem?

                ### Solution & Contribution
                - In this section, you should answer following questions:
                    - What is the authors solution to address the problem?
                    - How does their approach solve the problem?
                    - How unique and innovative is the solution?
                    - Summarize the key main ideas of the paper.
                    - What is the main contribution of this work?

                ### Experimental Evaluation
                - In this section, you should answer following questions:
                    - How do the authors evaluate their solution?
                    - What specific questions do they answer?
                    - What simplifying assumptions do they make?
                    - What is their methodology?
                    - What are the strengths and weaknesses of their solution?
                    - What is left unknown?
                
                ### Critical Analysis & Limitations
                - In this section, you should answer following questions:
                    - Is the problem still important?
                    - Did the authors solve the stated problem?
                    - Did the authors adequately demonstrate that they solved the problem?
                    - What future work does this research point to?
                - Include following directions:
                    - Criticize the main contributions (Limitations of the proposed design. Limitations of applicability etc.) 
                    - Rate the significance of the paper on a scale of 5 (breakthrough), 4 (significant contribution), 3 (modest contribution), 2 (incremental contribution), 1 (no contribution or negative contribution). Explain your rating.
                    - Rate how convincing is the evaluation methodology (Refer to the following questions). 
                        - Do the claims and conclusions follow from the experiments? 
                        - Are the assumptions realistic? Are the experiments well designed? 
                        - Are there different experiments that would be more convincing? 
                        - Are there other alternatives the authors should have considered? (And, of course, is the paper free of methodological errors.)
                    - Answer one of the following three questions (whichever is most relevant for this paper):
                        - What lessons should system researchers and builders take away from this work?
                        - What is the lasting impact of this work?
                        - What (if any) questions does this work leave open?
                \n
                # Format of Response
                - Use clear Markdown headers for the sections.\n
                **Note**: 
                    - Use bolding for key terms. 
                    - Ensure there is a blank line between sections and paragraphs for readability. 
                    - Do not start with "Here is a analysis of the paper ...".
                    - Use paragraphs for the content. (not bullet points)
                    - Start with Paper Title (# Paper Title) and conference name (#### Conference Name).\n
                \n
                # Paper Content
                ${text.substring(0, 150000)} 
                `;
                // Safety Truncate to ~30k chars to avoid basic limits if using Pro standard.
                // Better to use 1.5 Flash for large context.

                const result = await model.generateContent(prompt);
                const response = await result.response;
                const respText = response.text();

                // Translate to Korean
                const translationPrompt = `You are a professional translator. \n
                    Your task is to translate the following analysis into Korean. \n
                    Do not add any additional explanations. \n
                    Keep all Markdown formatting exactly the same:\n\n${respText}`;

                const translationResult = await model.generateContent(translationPrompt);
                const translationResponse = await translationResult.response;
                const koreanText = translationResponse.text();

                // Combine both responses
                return `${respText}\n\n---\n\n# [한국어 번역본]\n\n${koreanText}`;
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

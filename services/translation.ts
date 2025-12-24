// Using native fetch instead of ai SDK to avoid Node.js dependencies

export class TranslationService {
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	private async translateOnce(text: string, targetLanguage: string) {
		const response = await fetch(
			"https://openrouter.ai/api/v1/chat/completions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
					"HTTP-Referer": "https://murmur.app",
				},
				body: JSON.stringify({
					model: "meta-llama/llama-3.3-70b-instruct",
					messages: [
						{
							role: "user",
							content: `Translate the following text to ${targetLanguage}. Only provide the translation, no explanations or additional text:\n\n${text}`,
						},
					],
					temperature: 0.3,
					stream: false,
				}),
			},
		);

		if (!response.ok) {
			throw new Error(`OpenRouter API error: ${response.status}`);
		}

		const data = await response.json();
		const content = data?.choices?.[0]?.message?.content;
		if (!content) {
			throw new Error("OpenRouter API returned empty translation");
		}

		return content as string;
	}

	async translateStream(
		text: string,
		targetLanguage: string,
		onChunk: (chunk: string) => void,
		onComplete: (fullText: string) => void,
		onError: (error: Error) => void,
	) {
		try {
			const response = await fetch(
				"https://openrouter.ai/api/v1/chat/completions",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"Content-Type": "application/json",
						"HTTP-Referer": "https://murmur.app",
					},
					body: JSON.stringify({
						model: "anthropic/claude-3.5-haiku",
						messages: [
							{
								role: "user",
								content: `Translate the following text to ${targetLanguage}. Only provide the translation, no explanations or additional text:\n\n${text}`,
							},
						],
						temperature: 0.3,
						stream: true,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`OpenRouter API error: ${response.status}`);
			}

			const reader = response.body?.getReader();
			if (!reader) {
				const fullText = await this.translateOnce(text, targetLanguage);
				onChunk(fullText);
				onComplete(fullText);
				return;
			}

			const decoder = new TextDecoder();
			let fullTranslation = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split("\n").filter((line) => line.trim() !== "");

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const data = line.slice(6);
						if (data === "[DONE]") continue;

						try {
							const parsed = JSON.parse(data);
							const content = parsed.choices?.[0]?.delta?.content;
							if (content) {
								fullTranslation += content;
								onChunk(content);
							}
						} catch {
							// Ignore parse errors for incomplete chunks
						}
					}
				}
			}

			onComplete(fullTranslation);
		} catch (error) {
			onError(error as Error);
		}
	}
}

import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export class ComfyuiAny implements INodeType {
		description: INodeTypeDescription = {
			displayName: 'ComfyUI Output Any',
			name: 'comfyuiAny',
			icon: 'file:comfyui.svg',
			group: ['transform'],
			version: 1,
			description: 'Execute ComfyUI workflows and return promptResult outputs',
			defaults: {
				name: 'ComfyUI Output Any',
			},
			credentials: [
				{
					name: 'comfyUIApi',
					required: false,
				},
			],
			inputs: ['main'],
			outputs: ['main'],
			properties: [
				{
					displayName: 'API URL',
					name: 'apiUrl',
					type: 'string',
					default: '',
					required: false,
					description: 'The URL of your ComfyUI instance',
				},
				{
					displayName: 'API Key',
					name: 'apiKey',
					type: 'string',
					typeOptions: {
						password: true,
					},
					default: '',
					required: false,
					description: 'API Key if authentication is enabled',
				},
				{
					displayName: 'Workflow JSON',
					name: 'workflow',
					type: 'string',
					typeOptions: {
						rows: 10,
					},
					default: '',
					required: true,
					description: 'The ComfyUI workflow in JSON format',
				},
				{
					displayName: 'Timeout',
					name: 'timeout',
					type: 'number',
					default: 30,
					description: 'Maximum time in minutes to wait for workflow completion',
				},
			],
		};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		let apiUrl = this.getNodeParameter('apiUrl', 0) as string;
		let apiKey = this.getNodeParameter('apiKey', 0) as string;

		// If params are empty, try to read from optional credentials
		try {
			const creds = await this.getCredentials('comfyUIApi');
			if (!apiUrl && (creds as any)?.apiUrl) {
				apiUrl = (creds as any).apiUrl as string;
			}
			if (!apiKey && (creds as any)?.apiKey) {
				apiKey = (creds as any).apiKey as string;
			}
		} catch (_) {
			// credentials are optional; ignore if not provided
		}
		// Validate apiUrl from param or credentials
		if (!apiUrl || !String(apiUrl).trim()) {
			throw new NodeApiError(this.getNode(), { message: 'API URL is required. Set it in parameter "API URL" or configure the ComfyUI credential.' });
		}
		const workflow = this.getNodeParameter('workflow', 0) as string;
		const timeout = this.getNodeParameter('timeout', 0) as number;

		console.log('[ComfyUI] Executing with API URL:', apiUrl);

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (apiKey) {
			console.log('[ComfyUI] Using API key authentication');
			headers['Authorization'] = `Bearer ${apiKey}`;
		}

		try {
			// Check API connection
			console.log('[ComfyUI] Checking API connection...');
			await this.helpers.request({
				method: 'GET',
				url: `${apiUrl}/system_stats`,
				headers,
				json: true,
			});

			// Queue prompt
			console.log('[ComfyUI] Queueing prompt...');
			const response = await this.helpers.request({
				method: 'POST',
				url: `${apiUrl}/prompt`,
				headers,
				body: {
					prompt: JSON.parse(workflow),
				},
				json: true,
			});

			if (!response.prompt_id) {
				throw new NodeApiError(this.getNode(), { message: 'Failed to get prompt ID from ComfyUI' });
			}

			const promptId = response.prompt_id;
			console.log('[ComfyUI] Prompt queued with ID:', promptId);

			// Poll for completion
			let attempts = 0;
			const maxAttempts = 60 * timeout; // Convert minutes to seconds
			await new Promise(resolve => setTimeout(resolve, 5000));
			while (attempts < maxAttempts) {
				console.log(`[ComfyUI] Checking execution status (attempt ${attempts + 1}/${maxAttempts})...`);
				await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 seconds
				attempts++;

				const history = await this.helpers.request({
					method: 'GET',
					url: `${apiUrl}/history/${promptId}`,
					headers,
					json: true,
				});

				const promptResult = history[promptId];
				if (!promptResult) {
					console.log('[ComfyUI] Prompt not found in history');
					continue;
				}

				if (promptResult.status === undefined) {
					console.log('[ComfyUI] Execution status not found');
					continue;
				}
				if (promptResult.status?.completed) {
					console.log('[ComfyUI] Execution completed');

					if (promptResult.status?.status_str === 'error') {
						throw new NodeApiError(this.getNode(), { message: '[ComfyUI] Workflow execution failed' });
					}

					// Process outputs
					if (!promptResult.outputs) {
						throw new NodeApiError(this.getNode(), { message: '[ComfyUI] No outputs found in workflow result' });
					}

					console.log('[ComfyUI] All promptResult outputs: ',JSON.stringify(promptResult.outputs));

					return [this.helpers.returnJsonArray(promptResult.outputs)];
				}
			}
			throw new NodeApiError(this.getNode(), { message: `Execution timeout after ${timeout} minutes` });
		} catch (error) {
			console.error('[ComfyUI] Execution error:', error);
			throw new NodeApiError(this.getNode(), { message: `ComfyUI API Error: ${error.message}` });
		}
	}
}

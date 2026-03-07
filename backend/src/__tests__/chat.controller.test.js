/**
 * Unit Tests cho Chat Controller
 * 
 * Covers:
 * 1. Input validation (empty message, message length)
 * 2. Tasks context building
 * 3. Gemini API interaction (success, error, missing key)
 * 4. Response format
 */

import { jest } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const { chatWithAI } = await import('../controllers/chatController.js');

// ==================== HELPERS ====================
const mockRequest = (overrides = {}) => ({
    body: {},
    user: { _id: 'user123' },
    ...overrides,
});

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

// ==================== TESTS ====================
describe('chatWithAI', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv, GEMINI_API_KEY: 'test-api-key' };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    // ==================== INPUT VALIDATION ====================
    describe('Input Validation', () => {
        it('should return 400 when message is empty', async () => {
            const req = mockRequest({ body: {} });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Vui lòng nhập tin nhắn" });
        });

        it('should return 400 when message is null', async () => {
            const req = mockRequest({ body: { message: null } });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Vui lòng nhập tin nhắn" });
        });

        it('should return 400 when message is empty string', async () => {
            const req = mockRequest({ body: { message: "" } });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Vui lòng nhập tin nhắn" });
        });

        it('should return 400 when message exceeds 500 characters', async () => {
            const longMessage = 'a'.repeat(501);
            const req = mockRequest({ body: { message: longMessage } });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Tin nhắn không được vượt quá 500 ký tự" });
        });

        it('should accept message with exactly 500 characters', async () => {
            const exactMessage = 'a'.repeat(500);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: 'Reply' }] } }]
                }),
            });

            const req = mockRequest({ body: { message: exactMessage } });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(res.json).toHaveBeenCalledWith({ reply: 'Reply' });
        });
    });

    // ==================== API KEY ====================
    describe('API Key Validation', () => {
        it('should return 500 when GEMINI_API_KEY is not set', async () => {
            delete process.env.GEMINI_API_KEY;

            const req = mockRequest({ body: { message: 'Xin chào' } });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: "AI service chưa được cấu hình" });
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    // ==================== TASKS CONTEXT ====================
    describe('Tasks Context', () => {
        it('should send tasks context to API when tasks provided', async () => {
            const tasks = [
                { title: 'Task 1', status: 'pending', priority: 'high', createdAt: new Date().toISOString() },
                { title: 'Task 2', status: 'completed', priority: 'low', createdAt: new Date().toISOString() },
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: 'Bạn đang làm tốt!' }] } }]
                }),
            });

            const req = mockRequest({ body: { message: 'Tôi làm thế nào?', tasks } });
            const res = mockResponse();

            await chatWithAI(req, res);

            // Verify fetch was called with prompt containing task info
            const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            const promptText = fetchBody.contents[0].parts[0].text;
            expect(promptText).toContain('Task 1');
            expect(promptText).toContain('Task 2');
            expect(promptText).toContain('pending');
            expect(promptText).toContain('completed');
        });

        it('should handle empty tasks array', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: 'OK' }] } }]
                }),
            });

            const req = mockRequest({ body: { message: 'Xin chào', tasks: [] } });
            const res = mockResponse();

            await chatWithAI(req, res);

            const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            const promptText = fetchBody.contents[0].parts[0].text;
            expect(promptText).toContain('chưa có công việc nào');
        });

        it('should handle non-array tasks', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: 'OK' }] } }]
                }),
            });

            const req = mockRequest({ body: { message: 'Xin chào', tasks: 'invalid' } });
            const res = mockResponse();

            await chatWithAI(req, res);

            const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            const promptText = fetchBody.contents[0].parts[0].text;
            expect(promptText).toContain('chưa có công việc nào');
        });

        it('should limit tasks to MAX_TASKS_FOR_CONTEXT (50)', async () => {
            const tasks = Array.from({ length: 60 }, (_, i) => ({
                title: `Task ${i}`,
                status: 'pending',
                priority: 'medium',
                createdAt: new Date().toISOString(),
            }));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: 'OK' }] } }]
                }),
            });

            const req = mockRequest({ body: { message: 'Phân tích', tasks } });
            const res = mockResponse();

            await chatWithAI(req, res);

            const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            const promptText = fetchBody.contents[0].parts[0].text;
            // Should contain Task 49 (index 49, 50th task) but NOT Task 50
            expect(promptText).toContain('Task 49');
            expect(promptText).not.toContain('Task 50');
        });

        it('should include task statistics in prompt', async () => {
            const tasks = [
                { title: 'A', status: 'pending', priority: 'high', createdAt: new Date().toISOString() },
                { title: 'B', status: 'in-progress', priority: 'medium', createdAt: new Date().toISOString() },
                { title: 'C', status: 'completed', priority: 'low', createdAt: new Date().toISOString() },
                { title: 'D', status: 'cancelled', priority: 'high', createdAt: new Date().toISOString() },
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: 'OK' }] } }]
                }),
            });

            const req = mockRequest({ body: { message: 'Thống kê', tasks } });
            const res = mockResponse();

            await chatWithAI(req, res);

            const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            const promptText = fetchBody.contents[0].parts[0].text;
            expect(promptText).toContain('Tổng 4 nhiệm vụ');
            expect(promptText).toContain('1 chờ xử lý');
            expect(promptText).toContain('1 đang làm');
            expect(promptText).toContain('1 hoàn thành');
            expect(promptText).toContain('1 đã hủy');
            expect(promptText).toContain('2 nhiệm vụ ưu tiên cao');
        });
    });

    // ==================== GEMINI API ====================
    describe('Gemini API Interaction', () => {
        it('should call Gemini API with correct config', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: 'Xin chào!' }] } }]
                }),
            });

            const req = mockRequest({ body: { message: 'Hello' } });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('generativelanguage.googleapis.com');
            expect(url).toContain('gemini-2.5-flash');
            expect(options.method).toBe('POST');
            expect(options.headers['x-goog-api-key']).toBe('test-api-key');

            const body = JSON.parse(options.body);
            expect(body.generationConfig.temperature).toBe(0.7);
            expect(body.generationConfig.maxOutputTokens).toBe(1024);
        });

        it('should return AI reply on success', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: 'Bạn nên ưu tiên task A' }] } }]
                }),
            });

            const req = mockRequest({ body: { message: 'Tôi nên làm gì trước?' } });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(res.json).toHaveBeenCalledWith({ reply: 'Bạn nên ưu tiên task A' });
        });

        it('should return fallback when API returns no candidates', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ candidates: [] }),
            });

            const req = mockRequest({ body: { message: 'Xin chào' } });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(res.json).toHaveBeenCalledWith({ reply: 'Xin lỗi, tôi không thể trả lời.' });
        });

        it('should return fallback when API response has no content', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ candidates: [{ content: null }] }),
            });

            const req = mockRequest({ body: { message: 'Xin chào' } });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(res.json).toHaveBeenCalledWith({ reply: 'Xin lỗi, tôi không thể trả lời.' });
        });

        it('should handle Gemini API error response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => ({ error: { message: 'Rate limit exceeded' } }),
            });

            const req = mockRequest({ body: { message: 'Xin chào' } });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Không thể kết nối với AI',
                details: 'Rate limit exceeded',
            });
        });

        it('should handle Gemini API error without message', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: {} }),
            });

            const req = mockRequest({ body: { message: 'Xin chào' } });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Không thể kết nối với AI',
                details: 'Unknown error',
            });
        });

        it('should handle network/fetch error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const req = mockRequest({ body: { message: 'Xin chào' } });
            const res = mockResponse();

            await chatWithAI(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Không thể kết nối với AI',
                details: 'Network error',
            });
        });
    });
});

// /api/generate.js

// Hàm này xử lý yêu cầu từ frontend
export default async function handler(request, response) {

    // --- PHẦN SỬA LỖI 405 ---
    // Thêm các "headers" để cho phép trình duyệt gọi API này
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Khi trình duyệt gửi yêu cầu "thăm dò" (OPTIONS),
    // chúng ta trả về "OK" (200) để cho phép nó gửi yêu cầu POST thật
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }
    // --- KẾT THÚC PHẦN SỬA LỖI ---

    // Chỉ cho phép phương thức POST (cho yêu cầu tạo đề thật)
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    // Lấy API key từ Vercel Environment Variables
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        // Ghi log lỗi phía server để bạn kiểm tra (nếu cần)
        console.error('LỖI: Chưa thiết lập GEMINI_API_KEY trên Vercel.');
        return response.status(500).json({ error: 'API key chưa được cấu hình trên máy chủ.' });
    }

    // URL của Google Gemini API
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

    try {
        // Lấy nội dung prompt từ yêu cầu của frontend
        const { prompt } = request.body;

        if (!prompt) {
            return response.status(400).json({ error: 'Không nhận được prompt.' });
        }

        // Tạo payload để gửi đến Gemini
        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            // Cấu hình an toàn (tùy chọn)
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            ],
            generationConfig: {
                temperature: 0.8, // Tăng một chút sáng tạo
                topK: 40,
                topP: 0.9,
                maxOutputTokens: 2048,
            }
        };

        // Gọi đến API của Google (Backend gọi Backend)
        const geminiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        // Xử lý nếu Google báo lỗi
        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Lỗi từ Google API:', errorBody);
            return response.status(geminiResponse.status).json({ error: `Google API báo lỗi: ${errorBody}` });
        }

        // Lấy kết quả từ Google
        const data = await geminiResponse.json();

        // Trích xuất nội dung văn bản
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('Không trích xuất được text từ Google response:', data);
            return response.status(500).json({ error: 'Không nhận được nội dung từ AI.' });
        }

        // Gửi đề thi (text) về cho frontend
        response.status(200).json({ text });

    } catch (error) {
        // Ghi log lỗi chi tiết trên Vercel Logs
        console.error('Lỗi nghiêm trọng trong hàm API:', error);
        response.status(500).json({ error: `Lỗi máy chủ nội bộ: ${error.message}` });
    }
}
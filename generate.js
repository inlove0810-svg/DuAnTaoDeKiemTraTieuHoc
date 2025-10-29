// Đây là code chạy trên máy chủ (Node.js)
// Nó sẽ nhận yêu cầu từ index.html, gọi Gemini, và gửi kết quả về

export default async function handler(req, res) {
    // 1. Chỉ cho phép phương thức POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. Lấy API Key từ "Biến môi trường" (Nơi an toàn của Vercel)
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        // Thông báo lỗi nếu API key chưa được thiết lập trong Vercel
        return res.status(500).json({ error: 'API key is not configured. Please set the GEMINI_API_KEY environment variable on Vercel.' });
    }

    // URL thật của Gemini API - ĐÃ SỬA LỖI CHÍNH TẢ từ generativelace -> generativelanguage
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

    try {
        // 3. Lấy dữ liệu (subject, grade, topic...) mà index.html gửi lên
        const { subject, grade, topic, numQuestions, questionType } = req.body;
        
        // Kiểm tra validation đầu vào tối thiểu
        if (!topic || !subject || !grade) {
             return res.status(400).json({ error: 'Missing required fields: subject, grade, or topic.' });
        }


        // 4. Xây dựng prompt (logic này được chuyển từ frontend về backend)
        const systemPrompt = `Bạn là một trợ lý chuyên nghiệp, chuyên tạo ra các đề kiểm tra chất lượng cao cho giáo viên tiểu học tại Việt Nam. 
Đề bài phải rõ ràng, ngôn ngữ phù hợp với lứa tuổi học sinh, và bám sát chủ đề được cung cấp.
Định dạng đầu ra phải là văn bản thuần túy (plain text), sạch sẽ, dễ dàng sao chép và dán vào Microsoft Word.
Luôn bao gồm một tiêu đề chung cho bài kiểm tra (ví dụ: 'BÀI KIỂM TRA 15 PHÚT', 'ĐỀ KIỂM TRA CUỐI KỲ I').
KHÔNG cung cấp đáp án đúng hoặc lời giải. Chỉ tạo đề bài.
Khi tạo câu trắc nghiệm, luôn trình bày 4 đáp án A, B, C, D rõ ràng.`;

        const userQuery = `Hãy tạo một đề kiểm tra cho:
- Môn học: ${subject}
- Lớp: ${grade}
- Chủ đề/Bài học: ${topic}
- Số lượng câu hỏi: ${numQuestions}
- Loại câu hỏi: ${questionType}`;

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.7,
                topK: 40,
            }
        };

        // 5. Gọi đến Gemini API từ máy chủ
        const geminiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            throw new Error(`Gemini API error: ${geminiResponse.status}. Details: ${errorBody.substring(0, 100)}...`);
        }

        const result = await geminiResponse.json();

        // 6. Trích xuất text và gửi về cho frontend (index.html)
        if (result.candidates && result.candidates.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            // Gửi dữ liệu về thành công
            res.status(200).json({ text: text });
        } else {
            throw new Error('Invalid response from Gemini API: Missing candidate content.');
        }

    } catch (error) {
        console.error('Lỗi ở backend:', error.message);
        // Trả về lỗi chi tiết hơn cho frontend
        res.status(500).json({ error: `Server Error: Failed to generate content. Details: ${error.message}` });
    }
}